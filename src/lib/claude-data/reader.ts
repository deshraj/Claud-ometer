import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { calculateCostAllModes, getModelDisplayName, DEFAULT_COST_MODE } from '@/config/pricing';
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
  CostEstimates,
} from './types';

function zeroCosts(): CostEstimates {
  return { api: 0, conservative: 0, subscription: 0 };
}

function addCosts(a: CostEstimates, b: CostEstimates): CostEstimates {
  return {
    api: a.api + b.api,
    conservative: a.conservative + b.conservative,
    subscription: a.subscription + b.subscription,
  };
}

async function forEachJsonlLine(filePath: string, callback: (msg: SessionMessage) => void): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line) as SessionMessage;
      callback(msg);
    } catch { /* skip malformed line */ }
  }
}

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

function extractCwdFromSession(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8192); // Read first 8KB, enough for first few lines
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    const text = buffer.toString('utf-8', 0, bytesRead);
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.cwd) return msg.cwd;
      } catch { /* skip partial line */ }
    }
  } catch { /* skip */ }
  return null;
}

function getProjectNameFromDir(projectPath: string, projectId: string): { name: string; fullPath: string } {
  const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
  if (jsonlFiles.length > 0) {
    const cwd = extractCwdFromSession(path.join(projectPath, jsonlFiles[0]));
    if (cwd) return { name: path.basename(cwd), fullPath: cwd };
  }
  return { name: projectIdToName(projectId), fullPath: projectIdToFullPath(projectId) };
}

export async function getProjects(): Promise<ProjectInfo[]> {
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
    let estimatedCosts = zeroCosts();
    let lastActive = '';
    const modelsSet = new Set<string>();

    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const stat = fs.statSync(filePath);
      const mtime = stat.mtime.toISOString();
      if (!lastActive || mtime > lastActive) lastActive = mtime;

      await forEachJsonlLine(filePath, (msg) => {
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
            const costs = calculateCostAllModes(
              model,
              usage.input_tokens || 0,
              usage.output_tokens || 0,
              usage.cache_creation_input_tokens || 0,
              usage.cache_read_input_tokens || 0
            );
            estimatedCosts = addCosts(estimatedCosts, costs);
          }
        }
      });
    }

    const firstSessionPath = path.join(projectPath, jsonlFiles[0]);
    const cwd = extractCwdFromSession(firstSessionPath);

    projects.push({
      id: entry,
      name: cwd ? path.basename(cwd) : projectIdToName(entry),
      path: cwd || projectIdToFullPath(entry),
      sessionCount: jsonlFiles.length,
      totalMessages,
      totalTokens,
      estimatedCost: estimatedCosts[DEFAULT_COST_MODE],
      estimatedCosts,
      lastActive,
      models: Array.from(modelsSet).map(getModelDisplayName),
    });
  }

  return projects.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

export async function getProjectSessions(projectId: string): Promise<SessionInfo[]> {
  const projectPath = path.join(getProjectsDir(), projectId);
  if (!fs.existsSync(projectPath)) return [];

  const { name: projectName } = getProjectNameFromDir(projectPath, projectId);
  const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
  const sessions: SessionInfo[] = [];
  for (const file of jsonlFiles) {
    sessions.push(await parseSessionFile(path.join(projectPath, file), projectId, projectName));
  }
  return sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getSessions(limit = 50, offset = 0): Promise<SessionInfo[]> {
  const allSessions: SessionInfo[] = [];

  if (!fs.existsSync(getProjectsDir())) return [];
  const projectEntries = fs.readdirSync(getProjectsDir());

  for (const entry of projectEntries) {
    const projectPath = path.join(getProjectsDir(), entry);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const { name: projectName } = getProjectNameFromDir(projectPath, entry);
    const jsonlFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
    for (const file of jsonlFiles) {
      allSessions.push(await parseSessionFile(path.join(projectPath, file), entry, projectName));
    }
  }

  allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return allSessions.slice(offset, offset + limit);
}

async function parseSessionFile(filePath: string, projectId: string, projectName: string): Promise<SessionInfo> {
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
  let estimatedCosts = zeroCosts();
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

  await forEachJsonlLine(filePath, (msg) => {
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
        const costs = calculateCostAllModes(
          model,
          usage.input_tokens || 0,
          usage.output_tokens || 0,
          usage.cache_creation_input_tokens || 0,
          usage.cache_read_input_tokens || 0
        );
        estimatedCosts = addCosts(estimatedCosts, costs);
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
  });

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
    estimatedCost: estimatedCosts[DEFAULT_COST_MODE],
    estimatedCosts,
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

    const { name: projectName } = getProjectNameFromDir(projectPath, entry);
    const sessionInfo = await parseSessionFile(filePath, entry, projectName);
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

export async function searchSessions(query: string, limit = 50): Promise<SessionInfo[]> {
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

      let hasMatch = false;
      await forEachJsonlLine(filePath, (msg) => {
        if (hasMatch) return;
        if (msg.type === 'user' && msg.message?.role === 'user') {
          const content = msg.message.content;
          if (typeof content === 'string' && content.toLowerCase().includes(lowerQuery)) {
            hasMatch = true;
            return;
          }
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
                if ((c.text as string).toLowerCase().includes(lowerQuery)) {
                  hasMatch = true;
                  return;
                }
              }
            }
          }
        }
        if (msg.type === 'assistant' && msg.message?.content) {
          const content = msg.message.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
                if ((c.text as string).toLowerCase().includes(lowerQuery)) {
                  hasMatch = true;
                  return;
                }
              }
            }
          }
        }
      });

      if (hasMatch) {
        const { name: projectName } = getProjectNameFromDir(projectPath, entry);
        matchingSessions.push(await parseSessionFile(filePath, entry, projectName));
      }
    }
  }

  matchingSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return matchingSessions.slice(0, limit);
}

// --- Supplemental stats: bridge stale stats-cache.json with fresh JSONL data ---

interface SupplementalModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  estimatedCosts: CostEstimates;
}

interface SupplementalStats {
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, SupplementalModelUsage>;
  hourCounts: Record<string, number>;
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  estimatedCosts: CostEstimates;
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

async function computeSupplementalStats(afterDate: string): Promise<SupplementalStats> {
  const cacheKey = afterDate + ':' + getActiveDataSource();
  if (supplementalCache && supplementalCache.key === cacheKey && Date.now() - supplementalCache.ts < SUPPLEMENTAL_TTL_MS) {
    return supplementalCache.data;
  }

  const files = getRecentSessionFiles(afterDate);

  const dailyMap = new Map<string, DailyActivity>();
  const dailyModelMap = new Map<string, Record<string, number>>();
  const dailyModelCostMap = new Map<string, Record<string, CostEstimates>>();
  const modelUsage: Record<string, SupplementalModelUsage> = {};
  const hourCounts: Record<string, number> = {};
  let totalSessions = 0;
  let totalMessages = 0;
  let totalTokens = 0;
  let estimatedCosts = zeroCosts();

  for (const filePath of files) {
    let firstTimestamp = '';
    let sessionCounted = false;
    let firstQualifyingDate = '';

    await forEachJsonlLine(filePath, (msg) => {
      if (!msg.timestamp) return;

      if (!firstTimestamp) firstTimestamp = msg.timestamp;

      const msgDate = msg.timestamp.slice(0, 10);

      // Only count messages strictly after the cache boundary day
      if (afterDate && msgDate <= afterDate) return;

      // Count session once based on first qualifying message
      if (!sessionCounted) {
        totalSessions++;
        sessionCounted = true;
        firstQualifyingDate = msgDate;
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

          const costs = calculateCostAllModes(model, input, output, cacheWrite, cacheRead);
          estimatedCosts = addCosts(estimatedCosts, costs);

          // modelUsage
          if (model) {
            if (!modelUsage[model]) {
              modelUsage[model] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, estimatedCosts: zeroCosts() };
            }
            modelUsage[model].inputTokens += input;
            modelUsage[model].outputTokens += output;
            modelUsage[model].cacheReadInputTokens += cacheRead;
            modelUsage[model].cacheCreationInputTokens += cacheWrite;
            modelUsage[model].estimatedCosts = addCosts(modelUsage[model].estimatedCosts, costs);
          }

          // dailyModelTokens + dailyModelCosts
          if (model) {
            let dayModel = dailyModelMap.get(msgDate);
            if (!dayModel) {
              dayModel = {};
              dailyModelMap.set(msgDate, dayModel);
            }
            dayModel[model] = (dayModel[model] || 0) + tokens;

            let dayCost = dailyModelCostMap.get(msgDate);
            if (!dayCost) {
              dayCost = {};
              dailyModelCostMap.set(msgDate, dayCost);
            }
            dayCost[model] = dayCost[model] ? addCosts(dayCost[model], costs) : { ...costs };
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
    });

    // Track session count per day (based on first qualifying message)
    if (sessionCounted && firstQualifyingDate) {
      const day = dailyMap.get(firstQualifyingDate);
      if (day) day.sessionCount++;
    }
  }

  const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const dailyModelTokens: DailyModelTokens[] = Array.from(dailyModelMap.entries())
    .map(([date, tokensByModel]) => ({
      date,
      tokensByModel,
      costsByModel: dailyModelCostMap.get(date) || {},
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const result: SupplementalStats = {
    dailyActivity,
    dailyModelTokens,
    modelUsage,
    hourCounts,
    totalSessions,
    totalMessages,
    totalTokens,
    estimatedCosts,
  };

  supplementalCache = { key: cacheKey, data: result, ts: Date.now() };
  return result;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = getStatsCache();
  const projects = await getProjects();
  const afterDate = stats?.lastComputedDate || '';

  // Compute supplemental stats from JSONL files modified after the cache date
  const supplemental = await computeSupplementalStats(afterDate);

  // --- Base stats from cache ---
  let totalTokens = 0;
  let totalEstimatedCosts = zeroCosts();
  const modelUsageWithCost: Record<string, DashboardStats['modelUsage'][string]> = {};

  if (stats?.modelUsage) {
    for (const [model, usage] of Object.entries(stats.modelUsage)) {
      const costs = calculateCostAllModes(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheCreationInputTokens,
        usage.cacheReadInputTokens
      );
      const tokens = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
      totalTokens += tokens;
      totalEstimatedCosts = addCosts(totalEstimatedCosts, costs);
      modelUsageWithCost[model] = { ...usage, estimatedCost: costs[DEFAULT_COST_MODE], estimatedCosts: costs };
    }
  }

  // --- Merge supplemental model usage ---
  for (const [model, usage] of Object.entries(supplemental.modelUsage)) {
    const costs = usage.estimatedCosts;
    totalTokens += usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
    totalEstimatedCosts = addCosts(totalEstimatedCosts, costs);
    if (modelUsageWithCost[model]) {
      modelUsageWithCost[model].inputTokens += usage.inputTokens;
      modelUsageWithCost[model].outputTokens += usage.outputTokens;
      modelUsageWithCost[model].cacheReadInputTokens += usage.cacheReadInputTokens;
      modelUsageWithCost[model].cacheCreationInputTokens += usage.cacheCreationInputTokens;
      modelUsageWithCost[model].estimatedCost += costs[DEFAULT_COST_MODE];
      modelUsageWithCost[model].estimatedCosts = addCosts(modelUsageWithCost[model].estimatedCosts, costs);
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
        estimatedCost: costs[DEFAULT_COST_MODE],
        estimatedCosts: costs,
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

  // --- Merge dailyModelTokens (with costsByModel) ---
  // Build per-model cost-per-token ratios from overall model usage (for cache days without pre-computed costs)
  const modelCostPerToken: Record<string, CostEstimates> = {};
  for (const [model, usage] of Object.entries(modelUsageWithCost)) {
    const totalTok = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
    if (totalTok > 0 && usage.estimatedCosts) {
      modelCostPerToken[model] = {
        api: usage.estimatedCosts.api / totalTok,
        conservative: usage.estimatedCosts.conservative / totalTok,
        subscription: usage.estimatedCosts.subscription / totalTok,
      };
    }
  }

  const dailyModelTokenMap = new Map<string, Record<string, number>>();
  const dailyModelCostMergeMap = new Map<string, Record<string, CostEstimates>>();

  for (const d of (stats?.dailyModelTokens || [])) {
    dailyModelTokenMap.set(d.date, { ...d.tokensByModel });
    // Estimate costs for cache-sourced days using per-model ratio
    const dayCosts: Record<string, CostEstimates> = {};
    for (const [model, tokens] of Object.entries(d.tokensByModel)) {
      const ratio = modelCostPerToken[model];
      if (ratio) {
        dayCosts[model] = { api: tokens * ratio.api, conservative: tokens * ratio.conservative, subscription: tokens * ratio.subscription };
      }
    }
    dailyModelCostMergeMap.set(d.date, dayCosts);
  }

  for (const d of supplemental.dailyModelTokens) {
    const existingTokens = dailyModelTokenMap.get(d.date);
    const existingCosts = dailyModelCostMergeMap.get(d.date);
    if (existingTokens) {
      for (const [model, tokens] of Object.entries(d.tokensByModel)) {
        existingTokens[model] = (existingTokens[model] || 0) + tokens;
      }
      if (d.costsByModel && existingCosts) {
        for (const [model, costs] of Object.entries(d.costsByModel)) {
          existingCosts[model] = existingCosts[model] ? addCosts(existingCosts[model], costs) : { ...costs };
        }
      }
    } else {
      dailyModelTokenMap.set(d.date, { ...d.tokensByModel });
      dailyModelCostMergeMap.set(d.date, d.costsByModel ? { ...d.costsByModel } : {});
    }
  }

  const mergedDailyModelTokens: DailyModelTokens[] = Array.from(dailyModelTokenMap.entries())
    .map(([date, tokensByModel]) => ({
      date,
      tokensByModel,
      costsByModel: dailyModelCostMergeMap.get(date) || {},
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- Merge hourCounts ---
  const mergedHourCounts = { ...(stats?.hourCounts || {}) };
  for (const [hour, count] of Object.entries(supplemental.hourCounts)) {
    mergedHourCounts[hour] = (mergedHourCounts[hour] || 0) + count;
  }

  const recentSessions = await getSessions(10);

  // Use project-level totals for cost/tokens to stay consistent with the Projects page
  const projectTotalCosts: CostEstimates = projects.reduce(
    (sum, p) => addCosts(sum, p.estimatedCosts || { api: p.estimatedCost, conservative: p.estimatedCost, subscription: p.estimatedCost }),
    zeroCosts()
  );
  const projectTotalTokens = projects.reduce((sum, p) => sum + p.totalTokens, 0);

  const finalCosts = projectTotalCosts.api > 0 ? projectTotalCosts : totalEstimatedCosts;

  return {
    totalSessions: (stats?.totalSessions || 0) + supplemental.totalSessions,
    totalMessages: (stats?.totalMessages || 0) + supplemental.totalMessages,
    totalTokens: projectTotalTokens || totalTokens,
    estimatedCost: finalCosts[DEFAULT_COST_MODE],
    estimatedCosts: finalCosts,
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
