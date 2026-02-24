import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { calculateCost, getModelDisplayName } from '@/config/pricing';
import { getActiveDataSource, getImportDir } from './data-source';
import type {
  StatsCache,
  HistoryEntry,
  ProjectInfo,
  SessionInfo,
  SessionDetail,
  SessionMessageDisplay,
  DashboardStats,
  TokenUsage,
  SessionMessage,
} from './types';

function getClaudeDir(): string {
  if (getActiveDataSource() === 'imported') {
    return path.join(getImportDir(), 'claude-data');
  }
  return path.join(os.homedir(), '.claude');
}

function getProjectsDir(): string {
  return path.join(getClaudeDir(), 'projects');
}

export function getStatsCache(): StatsCache | null {
  const statsPath = path.join(getClaudeDir(), 'stats-cache.json');
  if (!fs.existsSync(statsPath)) return null;
  return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
}

export function getHistory(): HistoryEntry[] {
  const historyPath = path.join(getClaudeDir(), 'history.jsonl');
  if (!fs.existsSync(historyPath)) return [];
  const lines = fs.readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean);
  return lines.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean) as HistoryEntry[];
}

function projectIdToName(id: string): string {
  const decoded = id.replace(/^-/, '/').replace(/-/g, '/');
  const parts = decoded.split('/');
  return parts[parts.length - 1] || id;
}

function projectIdToFullPath(id: string): string {
  return id.replace(/^-/, '/').replace(/-/g, '/');
}

export function getProjects(): ProjectInfo[] {
  if (!fs.existsSync(getProjectsDir())) return [];
  const entries = fs.readdirSync(getProjectsDir());
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    const projectPath = path.join(getProjectsDir(), entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
    if (jsonlFiles.length === 0) continue;

    let totalMessages = 0;
    let totalTokens = 0;
    let estimatedCost = 0;
    let lastActive = '';
    const modelsSet = new Set<string>();

    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const stat = fs.statSync(filePath);
      const mtime = stat.mtime.toISOString();
      if (!lastActive || mtime > lastActive) lastActive = mtime;

      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as SessionMessage;
          if (msg.type === 'user') totalMessages++;
          if (msg.type === 'assistant') {
            totalMessages++;
            const model = msg.message?.model || '';
            if (model) modelsSet.add(model);
            const usage = msg.message?.usage;
            if (usage) {
              const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
              totalTokens += tokens;
              estimatedCost += calculateCost(
                model,
                usage.input_tokens || 0,
                usage.output_tokens || 0,
                usage.cache_creation_input_tokens || 0,
                usage.cache_read_input_tokens || 0
              );
            }
          }
        } catch { /* skip */ }
      }
    }

    projects.push({
      id: entry,
      name: projectIdToName(entry),
      path: projectIdToFullPath(entry),
      sessionCount: jsonlFiles.length,
      totalMessages,
      totalTokens,
      estimatedCost,
      lastActive,
      models: Array.from(modelsSet).map(getModelDisplayName),
    });
  }

  return projects.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

export function getProjectSessions(projectId: string): SessionInfo[] {
  const projectPath = path.join(getProjectsDir(), projectId);
  if (!fs.existsSync(projectPath)) return [];

  const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
  return jsonlFiles.map(file => parseSessionFile(path.join(projectPath, file), projectId, projectIdToName(projectId)))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getSessions(limit = 50, offset = 0): SessionInfo[] {
  const allSessions: SessionInfo[] = [];

  if (!fs.existsSync(getProjectsDir())) return [];
  const projectEntries = fs.readdirSync(getProjectsDir());

  for (const entry of projectEntries) {
    const projectPath = path.join(getProjectsDir(), entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
    for (const file of jsonlFiles) {
      allSessions.push(parseSessionFile(path.join(projectPath, file), entry, projectIdToName(entry)));
    }
  }

  allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return allSessions.slice(offset, offset + limit);
}

function parseSessionFile(filePath: string, projectId: string, projectName: string): SessionInfo {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const sessionId = path.basename(filePath, '.jsonl');

  let firstTimestamp = '';
  let lastTimestamp = '';
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let estimatedCost = 0;
  let gitBranch = '';
  let cwd = '';
  let version = '';
  const modelsSet = new Set<string>();
  const toolsUsed: Record<string, number> = {};

  // Compaction tracking
  let compactions = 0;
  let microcompactions = 0;
  let totalTokensSaved = 0;
  const compactionTimestamps: string[] = [];

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as SessionMessage;
      if (msg.timestamp) {
        if (!firstTimestamp) firstTimestamp = msg.timestamp;
        lastTimestamp = msg.timestamp;
      }
      if (msg.gitBranch && !gitBranch) gitBranch = msg.gitBranch;
      if (msg.cwd && !cwd) cwd = msg.cwd;
      if (msg.version && !version) version = msg.version;

      // Track compaction events
      if (msg.compactMetadata) {
        compactions++;
        if (msg.timestamp) compactionTimestamps.push(msg.timestamp);
      }
      if (msg.microcompactMetadata) {
        microcompactions++;
        totalTokensSaved += msg.microcompactMetadata.tokensSaved || 0;
        if (msg.timestamp) compactionTimestamps.push(msg.timestamp);
      }

      if (msg.type === 'user') {
        if (msg.message?.role === 'user' && typeof msg.message.content === 'string') {
          userMessageCount++;
        } else if (msg.message?.role === 'user') {
          userMessageCount++;
        }
      }
      if (msg.type === 'assistant') {
        assistantMessageCount++;
        const model = msg.message?.model || '';
        if (model) modelsSet.add(model);
        const usage = msg.message?.usage;
        if (usage) {
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;
          totalCacheReadTokens += usage.cache_read_input_tokens || 0;
          totalCacheWriteTokens += usage.cache_creation_input_tokens || 0;
          estimatedCost += calculateCost(
            model,
            usage.input_tokens || 0,
            usage.output_tokens || 0,
            usage.cache_creation_input_tokens || 0,
            usage.cache_read_input_tokens || 0
          );
        }
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c && typeof c === 'object' && 'type' in c && c.type === 'tool_use') {
              toolCallCount++;
              const name = ('name' in c ? c.name : 'unknown') as string;
              toolsUsed[name] = (toolsUsed[name] || 0) + 1;
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  const duration = firstTimestamp && lastTimestamp
    ? new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
    : 0;

  const models = Array.from(modelsSet);

  return {
    id: sessionId,
    projectId,
    projectName,
    timestamp: firstTimestamp || new Date().toISOString(),
    duration,
    messageCount: userMessageCount + assistantMessageCount,
    userMessageCount,
    assistantMessageCount,
    toolCallCount,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    estimatedCost,
    model: models[0] || 'unknown',
    models: models.map(getModelDisplayName),
    gitBranch,
    cwd,
    version,
    toolsUsed,
    compaction: {
      compactions,
      microcompactions,
      totalTokensSaved,
      compactionTimestamps,
    },
  };
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  if (!fs.existsSync(getProjectsDir())) return null;
  const projectEntries = fs.readdirSync(getProjectsDir());

  for (const entry of projectEntries) {
    const projectPath = path.join(getProjectsDir(), entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const filePath = path.join(projectPath, `${sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) continue;

    const sessionInfo = parseSessionFile(filePath, entry, projectIdToName(entry));
    const messages: SessionMessageDisplay[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as SessionMessage;
        if (msg.type === 'user' && msg.message?.role === 'user') {
          const content = msg.message.content;
          let text = '';
          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content
              .map((c: Record<string, unknown>) => {
                if (c.type === 'text') return c.text as string;
                if (c.type === 'tool_result') return '[Tool Result]';
                return '';
              })
              .filter(Boolean)
              .join('\n');
          }
          if (text && !text.startsWith('[Tool Result]')) {
            messages.push({
              role: 'user',
              content: text,
              timestamp: msg.timestamp,
            });
          }
        }
        if (msg.type === 'assistant' && msg.message?.content) {
          const content = msg.message.content;
          const toolCalls: { name: string; id: string }[] = [];
          let text = '';
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c && typeof c === 'object') {
                if ('type' in c && c.type === 'text' && 'text' in c) {
                  text += (c.text as string) + '\n';
                }
                if ('type' in c && c.type === 'tool_use' && 'name' in c) {
                  toolCalls.push({ name: c.name as string, id: (c.id as string) || '' });
                }
              }
            }
          }
          if (text.trim() || toolCalls.length > 0) {
            messages.push({
              role: 'assistant',
              content: text.trim() || `[Used ${toolCalls.length} tool(s): ${toolCalls.map(t => t.name).join(', ')}]`,
              timestamp: msg.timestamp,
              model: msg.message.model,
              usage: msg.message.usage as TokenUsage | undefined,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
        }
      } catch { /* skip */ }
    }

    return { ...sessionInfo, messages };
  }

  return null;
}

export function getDashboardStats(): DashboardStats {
  const stats = getStatsCache();
  const projects = getProjects();

  let totalTokens = 0;
  let estimatedCost = 0;
  const modelUsageWithCost: Record<string, DashboardStats['modelUsage'][string]> = {};

  if (stats?.modelUsage) {
    for (const [model, usage] of Object.entries(stats.modelUsage)) {
      const cost = calculateCost(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheCreationInputTokens,
        usage.cacheReadInputTokens
      );
      const tokens = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
      totalTokens += tokens;
      estimatedCost += cost;
      modelUsageWithCost[model] = { ...usage, estimatedCost: cost };
    }
  }

  const recentSessions = getSessions(10);

  return {
    totalSessions: stats?.totalSessions || 0,
    totalMessages: stats?.totalMessages || 0,
    totalTokens,
    estimatedCost,
    dailyActivity: stats?.dailyActivity || [],
    dailyModelTokens: stats?.dailyModelTokens || [],
    modelUsage: modelUsageWithCost,
    hourCounts: stats?.hourCounts || {},
    firstSessionDate: stats?.firstSessionDate || '',
    longestSession: stats?.longestSession || { sessionId: '', duration: 0, messageCount: 0, timestamp: '' },
    projectCount: projects.length,
    recentSessions,
  };
}
