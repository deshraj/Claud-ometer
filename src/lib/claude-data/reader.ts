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
  DailyActivity,
  DailyModelTokens,
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

export function searchSessions(query: string, limit = 50): SessionInfo[] {
  if (!query.trim()) return getSessions(limit, 0);

  const lowerQuery = query.toLowerCase();
  const matchingSessions: SessionInfo[] = [];

  if (!fs.existsSync(getProjectsDir())) return [];
  const projectEntries = fs.readdirSync(getProjectsDir());

  for (const entry of projectEntries) {
    const projectPath = path.join(getProjectsDir(), entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(Boolean);

      let hasMatch = false;
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as SessionMessage;
          if (msg.type === 'user' && msg.message?.role === 'user') {
            const content = msg.message.content;
            if (typeof content === 'string' && content.toLowerCase().includes(lowerQuery)) {
              hasMatch = true;
              break;
            }
            if (Array.isArray(content)) {
              for (const c of content) {
                if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
                  if ((c.text as string).toLowerCase().includes(lowerQuery)) {
                    hasMatch = true;
                    break;
                  }
                }
              }
              if (hasMatch) break;
            }
          }
          if (msg.type === 'assistant' && msg.message?.content) {
            const content = msg.message.content;
            if (Array.isArray(content)) {
              for (const c of content) {
                if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
                  if ((c.text as string).toLowerCase().includes(lowerQuery)) {
                    hasMatch = true;
                    break;
                  }
                }
              }
              if (hasMatch) break;
            }
          }
        } catch { /* skip */ }
      }

      if (hasMatch) {
        matchingSessions.push(parseSessionFile(filePath, entry, projectIdToName(entry)));
      }
    }
  }

  matchingSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return matchingSessions.slice(0, limit);
}

// --- Supplemental stats: bridge stale stats-cache.json with fresh JSONL data ---

interface SupplementalStats {
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
  hourCounts: Record<string, number>;
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
}

let supplementalCache: { key: string; data: SupplementalStats; ts: number } | null = null;
const SUPPLEMENTAL_TTL_MS = 30_000;

function getRecentSessionFiles(afterDate: string): string[] {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];

  const cutoff = afterDate ? new Date(afterDate + 'T23:59:59Z').getTime() : 0;
  const files: string[] = [];

  for (const entry of fs.readdirSync(projectsDir)) {
    const projectPath = path.join(projectsDir, entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    for (const f of fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))) {
      const filePath = path.join(projectPath, f);
      if (fs.statSync(filePath).mtimeMs > cutoff) {
        files.push(filePath);
      }
    }
  }

  return files;
}

function computeSupplementalStats(afterDate: string): SupplementalStats {
  const cacheKey = afterDate + ':' + getActiveDataSource();
  if (supplementalCache && supplementalCache.key === cacheKey && Date.now() - supplementalCache.ts < SUPPLEMENTAL_TTL_MS) {
    return supplementalCache.data;
  }

  const files = getRecentSessionFiles(afterDate);

  const dailyMap = new Map<string, DailyActivity>();
  const dailyModelMap = new Map<string, Record<string, number>>();
  const modelUsage: SupplementalStats['modelUsage'] = {};
  const hourCounts: Record<string, number> = {};
  let totalSessions = 0;
  let totalMessages = 0;
  let totalTokens = 0;
  let estimatedCost = 0;

  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);

    let firstTimestamp = '';
    let sessionCounted = false;

    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as SessionMessage;
        if (!msg.timestamp) continue;

        if (!firstTimestamp) firstTimestamp = msg.timestamp;

        const msgDate = msg.timestamp.slice(0, 10);

        // Only count messages strictly after the cache boundary day
        if (afterDate && msgDate <= afterDate) continue;

        // Count session once based on first qualifying message
        if (!sessionCounted) {
          totalSessions++;
          sessionCounted = true;
        }

        const hour = msg.timestamp.slice(11, 13);

        if (msg.type === 'user' || msg.type === 'assistant') {
          totalMessages++;

          // dailyActivity
          let day = dailyMap.get(msgDate);
          if (!day) {
            day = { date: msgDate, messageCount: 0, sessionCount: 0, toolCallCount: 0 };
            dailyMap.set(msgDate, day);
          }
          day.messageCount++;
        }

        if (msg.type === 'assistant') {
          const model = msg.message?.model || '';
          const usage = msg.message?.usage;

          if (usage) {
            const input = usage.input_tokens || 0;
            const output = usage.output_tokens || 0;
            const cacheRead = usage.cache_read_input_tokens || 0;
            const cacheWrite = usage.cache_creation_input_tokens || 0;
            const tokens = input + output + cacheRead + cacheWrite;
            totalTokens += tokens;

            const cost = calculateCost(model, input, output, cacheWrite, cacheRead);
            estimatedCost += cost;

            // modelUsage
            if (model) {
              if (!modelUsage[model]) {
                modelUsage[model] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
              }
              modelUsage[model].inputTokens += input;
              modelUsage[model].outputTokens += output;
              modelUsage[model].cacheReadInputTokens += cacheRead;
              modelUsage[model].cacheCreationInputTokens += cacheWrite;
            }

            // dailyModelTokens
            if (model) {
              let dayModel = dailyModelMap.get(msgDate);
              if (!dayModel) {
                dayModel = {};
                dailyModelMap.set(msgDate, dayModel);
              }
              dayModel[model] = (dayModel[model] || 0) + tokens;
            }

            // hourCounts
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }

          // tool calls
          const content = msg.message?.content;
          if (Array.isArray(content)) {
            let toolCalls = 0;
            for (const c of content) {
              if (c && typeof c === 'object' && 'type' in c && c.type === 'tool_use') {
                toolCalls++;
              }
            }
            if (toolCalls > 0) {
              const day = dailyMap.get(msgDate);
              if (day) day.toolCallCount += toolCalls;
            }
          }
        }
      } catch { /* skip */ }
    }

    // Track session count per day (based on first qualifying message)
    if (sessionCounted && firstTimestamp) {
      // Find the first date that's after the cutoff
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as SessionMessage;
          if (!msg.timestamp) continue;
          const d = msg.timestamp.slice(0, 10);
          if (afterDate && d <= afterDate) continue;
          const day = dailyMap.get(d);
          if (day) day.sessionCount++;
          break;
        } catch { /* skip */ }
      }
    }
  }

  const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const dailyModelTokens: DailyModelTokens[] = Array.from(dailyModelMap.entries())
    .map(([date, tokensByModel]) => ({ date, tokensByModel }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const result: SupplementalStats = {
    dailyActivity,
    dailyModelTokens,
    modelUsage,
    hourCounts,
    totalSessions,
    totalMessages,
    totalTokens,
    estimatedCost,
  };

  supplementalCache = { key: cacheKey, data: result, ts: Date.now() };
  return result;
}

export function getDashboardStats(): DashboardStats {
  const stats = getStatsCache();
  const projects = getProjects();
  const afterDate = stats?.lastComputedDate || '';

  // Compute supplemental stats from JSONL files modified after the cache date
  const supplemental = computeSupplementalStats(afterDate);

  // --- Base stats from cache ---
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

  // --- Merge supplemental model usage ---
  for (const [model, usage] of Object.entries(supplemental.modelUsage)) {
    const cost = calculateCost(model, usage.inputTokens, usage.outputTokens, usage.cacheCreationInputTokens, usage.cacheReadInputTokens);
    totalTokens += usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
    estimatedCost += cost;
    if (modelUsageWithCost[model]) {
      modelUsageWithCost[model].inputTokens += usage.inputTokens;
      modelUsageWithCost[model].outputTokens += usage.outputTokens;
      modelUsageWithCost[model].cacheReadInputTokens += usage.cacheReadInputTokens;
      modelUsageWithCost[model].cacheCreationInputTokens += usage.cacheCreationInputTokens;
      modelUsageWithCost[model].estimatedCost += cost;
    } else {
      modelUsageWithCost[model] = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        costUSD: 0,
        contextWindow: 0,
        maxOutputTokens: 0,
        webSearchRequests: 0,
        estimatedCost: cost,
      };
    }
  }

  // --- Merge dailyActivity ---
  const dailyActivityMap = new Map<string, DailyActivity>();
  for (const d of (stats?.dailyActivity || [])) {
    dailyActivityMap.set(d.date, { ...d });
  }
  for (const d of supplemental.dailyActivity) {
    const existing = dailyActivityMap.get(d.date);
    if (existing) {
      existing.messageCount += d.messageCount;
      existing.sessionCount += d.sessionCount;
      existing.toolCallCount += d.toolCallCount;
    } else {
      dailyActivityMap.set(d.date, { ...d });
    }
  }
  const mergedDailyActivity = Array.from(dailyActivityMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // --- Merge dailyModelTokens ---
  const dailyModelMap = new Map<string, Record<string, number>>();
  for (const d of (stats?.dailyModelTokens || [])) {
    dailyModelMap.set(d.date, { ...d.tokensByModel });
  }
  for (const d of supplemental.dailyModelTokens) {
    const existing = dailyModelMap.get(d.date);
    if (existing) {
      for (const [model, tokens] of Object.entries(d.tokensByModel)) {
        existing[model] = (existing[model] || 0) + tokens;
      }
    } else {
      dailyModelMap.set(d.date, { ...d.tokensByModel });
    }
  }
  const mergedDailyModelTokens = Array.from(dailyModelMap.entries())
    .map(([date, tokensByModel]) => ({ date, tokensByModel }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- Merge hourCounts ---
  const mergedHourCounts = { ...(stats?.hourCounts || {}) };
  for (const [hour, count] of Object.entries(supplemental.hourCounts)) {
    mergedHourCounts[hour] = (mergedHourCounts[hour] || 0) + count;
  }

  const recentSessions = getSessions(10);

  return {
    totalSessions: (stats?.totalSessions || 0) + supplemental.totalSessions,
    totalMessages: (stats?.totalMessages || 0) + supplemental.totalMessages,
    totalTokens,
    estimatedCost,
    dailyActivity: mergedDailyActivity,
    dailyModelTokens: mergedDailyModelTokens,
    modelUsage: modelUsageWithCost,
    hourCounts: mergedHourCounts,
    firstSessionDate: stats?.firstSessionDate || '',
    longestSession: stats?.longestSession || { sessionId: '', duration: 0, messageCount: 0, timestamp: '' },
    projectCount: projects.length,
    recentSessions,
  };
}
