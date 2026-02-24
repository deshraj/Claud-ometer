export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
  webSearchRequests: number;
}

export interface LongestSession {
  sessionId: string;
  duration: number;
  messageCount: number;
  timestamp: string;
}

export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession: LongestSession;
  firstSessionDate: string;
  hourCounts: Record<string, number>;
  totalSpeculationTimeSavedMs: number;
}

export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
}

export interface CompactMetadata {
  trigger: string;
  preTokens: number;
}

export interface MicrocompactMetadata {
  trigger: string;
  preTokens: number;
  tokensSaved: number;
  compactedToolIds: string[];
  clearedAttachmentUUIDs: string[];
}

export interface SessionMessage {
  type: 'user' | 'assistant' | 'progress' | 'system' | 'file-history-snapshot';
  sessionId: string;
  timestamp: string;
  uuid: string;
  parentUuid: string | null;
  cwd: string;
  version: string;
  gitBranch: string;
  compactMetadata?: CompactMetadata;
  microcompactMetadata?: MicrocompactMetadata;
  isCompactSummary?: boolean;
  message?: {
    role: string;
    model?: string;
    content: unknown;
    usage?: TokenUsage;
    stop_reason?: string | null;
  };
  data?: {
    type: string;
    elapsedTimeMs?: number;
    toolName?: string;
    serverName?: string;
    statusMessage?: string;
  };
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  service_tier?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
  lastActive: string;
  models: string[];
}

export interface CompactionInfo {
  compactions: number;
  microcompactions: number;
  totalTokensSaved: number;
  compactionTimestamps: string[];
}

export interface SessionInfo {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  duration: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  estimatedCost: number;
  model: string;
  models: string[];
  gitBranch: string;
  cwd: string;
  version: string;
  toolsUsed: Record<string, number>;
  compaction: CompactionInfo;
}

export interface SessionDetail extends SessionInfo {
  messages: SessionMessageDisplay[];
}

export interface SessionMessageDisplay {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  usage?: TokenUsage;
  toolCalls?: { name: string; id: string }[];
}

export interface DashboardStats {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage & { estimatedCost: number }>;
  hourCounts: Record<string, number>;
  firstSessionDate: string;
  longestSession: LongestSession;
  projectCount: number;
  recentSessions: SessionInfo[];
}
