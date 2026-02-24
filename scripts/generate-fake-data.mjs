/**
 * Generates realistic fake Claude Code data and writes it as a zip
 * that can be imported via the dashboard's /api/import endpoint.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import archiver from 'archiver';

const OUTPUT_PATH = path.join(process.cwd(), '/tmp/fake-claude-data.zip');

// --- Config ---
const PROJECTS = [
  { name: 'acme-web', fullPath: '/Users/alex/Projects/acme-web' },
  { name: 'ml-pipeline', fullPath: '/Users/alex/Projects/ml-pipeline' },
  { name: 'api-gateway', fullPath: '/Users/alex/Projects/api-gateway' },
  { name: 'mobile-app', fullPath: '/Users/alex/Projects/mobile-app' },
  { name: 'design-system', fullPath: '/Users/alex/Projects/design-system' },
  { name: 'infra-terraform', fullPath: '/Users/alex/Projects/infra-terraform' },
  { name: 'data-dashboard', fullPath: '/Users/alex/Projects/data-dashboard' },
  { name: 'auth-service', fullPath: '/Users/alex/Projects/auth-service' },
];

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

const BRANCHES = [
  'main', 'feat/auth-flow', 'fix/memory-leak', 'refactor/api-client',
  'feat/dark-mode', 'fix/race-condition', 'feat/streaming', 'chore/deps',
];

const TOOLS = [
  'Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'Task',
  'WebSearch', 'WebFetch', 'NotebookEdit',
];

const USER_PROMPTS = [
  'Fix the failing test in auth.test.ts',
  'Add dark mode support to the settings page',
  'Refactor the API client to use async/await',
  'Create a new endpoint for user preferences',
  'Optimize the database queries in the dashboard',
  'Add error handling to the payment flow',
  'Write unit tests for the cart component',
  'Update the CI pipeline to run on ARM',
  'Fix the memory leak in the websocket handler',
  'Add rate limiting to the API gateway',
  'Implement the search feature with fuzzy matching',
  'Create a migration script for the new schema',
  'Add caching to the product listing page',
  'Fix the race condition in the queue worker',
  'Set up monitoring with Prometheus metrics',
  'Refactor the auth middleware to support OAuth',
  'Add pagination to the user list endpoint',
  'Write integration tests for the checkout flow',
  'Fix the CSS layout issue on mobile',
  'Implement the notification system',
];

const ASSISTANT_TEXTS = [
  'I\'ll fix this by updating the test expectations to match the new API response format.',
  'Let me read the current implementation first to understand the architecture.',
  'I\'ve identified the issue. The problem is in the error handling middleware.',
  'Here\'s my plan: First, I\'ll refactor the base component, then update all consumers.',
  'The test is now passing. I also added a few edge case tests.',
  'I\'ll need to modify 3 files to implement this feature properly.',
  'Done. The migration script handles both the forward and rollback cases.',
  'I\'ve optimized the query by adding a composite index and using a JOIN instead of subquery.',
  'Let me search for all usages of this deprecated API before making changes.',
  'The fix is deployed. I also added a regression test to prevent this from happening again.',
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function pickModel() {
  const r = Math.random();
  if (r < 0.45) return MODELS[0]; // Opus
  if (r < 0.85) return MODELS[1]; // Sonnet
  return MODELS[2]; // Haiku
}

function projectIdFromPath(p) {
  return p.replace(/\//g, '-').replace(/^-/, '-');
}

function generateSession(project, dateStr, model) {
  const sessionId = randomUUID();
  const branch = pick(BRANCHES);
  const version = '2.1.52';
  const lines = [];

  const baseDate = new Date(dateStr);
  baseDate.setHours(rand(8, 23), rand(0, 59), rand(0, 59));
  let currentTime = baseDate.getTime();

  const msgCount = rand(15, 180);
  let userMsgCount = 0;
  let assistantMsgCount = 0;
  let toolCallCount = 0;
  let compactions = 0;

  for (let i = 0; i < msgCount; i++) {
    currentTime += rand(2000, 60000);
    const timestamp = new Date(currentTime).toISOString();
    const uuid = randomUUID();

    if (i % 2 === 0 || i === 0) {
      // User message
      userMsgCount++;
      lines.push(JSON.stringify({
        type: 'user',
        sessionId,
        timestamp,
        uuid,
        parentUuid: null,
        cwd: project.fullPath,
        version,
        gitBranch: branch,
        message: {
          role: 'user',
          content: pick(USER_PROMPTS),
        },
      }));
    } else {
      // Assistant message
      assistantMsgCount++;
      const numTools = Math.random() < 0.6 ? rand(1, 4) : 0;
      const content = [];

      if (Math.random() < 0.7) {
        content.push({ type: 'text', text: pick(ASSISTANT_TEXTS) });
      }

      for (let t = 0; t < numTools; t++) {
        toolCallCount++;
        content.push({
          type: 'tool_use',
          name: pick(TOOLS),
          id: `toolu_${randomUUID().slice(0, 20)}`,
          input: {},
        });
      }

      if (content.length === 0) {
        content.push({ type: 'text', text: pick(ASSISTANT_TEXTS) });
      }

      const inputTokens = rand(50, 2000);
      const outputTokens = rand(100, 5000);
      const cacheRead = rand(10000, 500000);
      const cacheWrite = rand(1000, 50000);

      lines.push(JSON.stringify({
        type: 'assistant',
        sessionId,
        timestamp,
        uuid,
        parentUuid: null,
        cwd: project.fullPath,
        version,
        gitBranch: branch,
        message: {
          role: 'assistant',
          model,
          content,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_read_input_tokens: cacheRead,
            cache_creation_input_tokens: cacheWrite,
            service_tier: 'standard',
          },
          stop_reason: numTools > 0 ? 'tool_use' : 'end_turn',
        },
      }));
    }

    // Add compaction events for long sessions
    if (i > 0 && i % 60 === 0 && Math.random() < 0.7) {
      compactions++;
      currentTime += 500;
      lines.push(JSON.stringify({
        type: 'system',
        sessionId,
        timestamp: new Date(currentTime).toISOString(),
        uuid: randomUUID(),
        parentUuid: null,
        cwd: project.fullPath,
        version,
        gitBranch: branch,
        compactMetadata: {
          trigger: 'auto',
          preTokens: rand(150000, 200000),
        },
      }));
    }

    // Add micro-compaction occasionally
    if (i > 30 && i % 45 === 0 && Math.random() < 0.4) {
      currentTime += 300;
      lines.push(JSON.stringify({
        type: 'system',
        sessionId,
        timestamp: new Date(currentTime).toISOString(),
        uuid: randomUUID(),
        parentUuid: null,
        cwd: project.fullPath,
        version,
        gitBranch: branch,
        microcompactMetadata: {
          trigger: 'auto',
          preTokens: rand(60000, 100000),
          tokensSaved: rand(15000, 50000),
          compactedToolIds: Array.from({ length: rand(2, 8) }, () => `toolu_${randomUUID().slice(0, 20)}`),
          clearedAttachmentUUIDs: [],
        },
      }));
    }
  }

  const duration = currentTime - baseDate.getTime();

  return {
    sessionId,
    content: lines.join('\n') + '\n',
    stats: { userMsgCount, assistantMsgCount, toolCallCount, duration, compactions, model },
    branch,
    baseDate,
  };
}

function generateStatsCache(allSessions) {
  const dailyMap = {};
  const dailyModelMap = {};
  const modelUsage = {};
  const hourCounts = {};
  let totalSessions = 0;
  let totalMessages = 0;

  for (const s of allSessions) {
    const dateStr = s.baseDate.toISOString().slice(0, 10);
    const hour = s.baseDate.getHours().toString();

    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, messageCount: 0, sessionCount: 0, toolCallCount: 0 };
    }
    dailyMap[dateStr].messageCount += s.stats.userMsgCount + s.stats.assistantMsgCount;
    dailyMap[dateStr].sessionCount += 1;
    dailyMap[dateStr].toolCallCount += s.stats.toolCallCount;

    if (!dailyModelMap[dateStr]) {
      dailyModelMap[dateStr] = { date: dateStr, tokensByModel: {} };
    }
    dailyModelMap[dateStr].tokensByModel[s.stats.model] =
      (dailyModelMap[dateStr].tokensByModel[s.stats.model] || 0) + rand(5000, 50000);

    if (!modelUsage[s.stats.model]) {
      modelUsage[s.stats.model] = {
        inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0, costUSD: 0, webSearchRequests: 0,
        contextWindow: 0, maxOutputTokens: 0,
      };
    }
    modelUsage[s.stats.model].inputTokens += rand(5000, 50000);
    modelUsage[s.stats.model].outputTokens += rand(10000, 80000);
    modelUsage[s.stats.model].cacheReadInputTokens += rand(500000, 5000000);
    modelUsage[s.stats.model].cacheCreationInputTokens += rand(50000, 500000);

    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    totalSessions++;
    totalMessages += s.stats.userMsgCount + s.stats.assistantMsgCount;
  }

  const dailyActivity = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const dailyModelTokens = Object.values(dailyModelMap).sort((a, b) => a.date.localeCompare(b.date));

  // Find longest session
  const longest = allSessions.reduce((max, s) =>
    s.stats.duration > (max?.stats.duration || 0) ? s : max, allSessions[0]);

  return {
    version: 2,
    lastComputedDate: new Date().toISOString().slice(0, 10),
    dailyActivity,
    dailyModelTokens,
    modelUsage,
    totalSessions,
    totalMessages,
    longestSession: {
      sessionId: longest.sessionId,
      duration: longest.stats.duration,
      messageCount: longest.stats.userMsgCount + longest.stats.assistantMsgCount,
      timestamp: longest.baseDate.toISOString(),
    },
    firstSessionDate: allSessions[0].baseDate.toISOString(),
    hourCounts,
    totalSpeculationTimeSavedMs: 0,
  };
}

function generateHistory(allSessions) {
  const entries = [];
  for (const s of allSessions) {
    for (let i = 0; i < rand(1, 5); i++) {
      entries.push(JSON.stringify({
        display: pick(USER_PROMPTS),
        pastedContents: {},
        timestamp: s.baseDate.getTime() + rand(0, 60000),
        project: PROJECTS.find(p => true)?.fullPath || '',
      }));
    }
  }
  return entries.join('\n') + '\n';
}

async function main() {
  console.log('Generating fake Claude Code data...');

  const allSessions = [];

  // Generate 90 days of data
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);

  for (const project of PROJECTS) {
    const sessionsPerProject = rand(8, 25);
    for (let i = 0; i < sessionsPerProject; i++) {
      const dayOffset = rand(0, 90);
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().slice(0, 10);
      const model = pickModel();

      const session = generateSession(project, dateStr, model);
      session.project = project;
      allSessions.push(session);
    }
  }

  allSessions.sort((a, b) => a.baseDate.getTime() - b.baseDate.getTime());

  console.log(`Generated ${allSessions.length} sessions across ${PROJECTS.length} projects`);

  // Create zip
  const tmpDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const output = fs.createWriteStream(OUTPUT_PATH);
  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.pipe(output);

  // Stats cache
  const statsCache = generateStatsCache(allSessions);
  archive.append(JSON.stringify(statsCache, null, 2), { name: 'claude-data/stats-cache.json' });

  // History
  archive.append(generateHistory(allSessions), { name: 'claude-data/history.jsonl' });

  // Settings
  archive.append(JSON.stringify({ hooks: {}, skipDangerousModePermissionPrompt: false }, null, 2), {
    name: 'claude-data/settings.json',
  });

  // Sessions per project
  for (const project of PROJECTS) {
    const projectId = projectIdFromPath(project.fullPath);
    const projectSessions = allSessions.filter(s => s.project === project);

    for (const session of projectSessions) {
      archive.append(session.content, {
        name: `claude-data/projects/${projectId}/${session.sessionId}.jsonl`,
      });
    }
  }

  // Plans
  const planNames = ['auth-redesign', 'api-v2-migration', 'perf-optimization', 'mobile-refactor'];
  for (const name of planNames) {
    archive.append(`# ${name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n## Overview\nPlan for ${name}.\n\n## Steps\n1. Analyze current implementation\n2. Design new architecture\n3. Implement changes\n4. Test and validate\n`, {
      name: `claude-data/plans/${name}.md`,
    });
  }

  // Export metadata
  archive.append(JSON.stringify({
    exportedAt: new Date().toISOString(),
    exportedFrom: 'demo-machine',
    platform: 'darwin',
  }, null, 2), { name: 'claude-data/export-meta.json' });

  await archive.finalize();

  await new Promise(resolve => output.on('close', resolve));
  const size = fs.statSync(OUTPUT_PATH).size;
  console.log(`Zip created: ${OUTPUT_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(console.error);
