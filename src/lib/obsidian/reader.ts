import { readdir, readFile, writeFile, stat, unlink } from 'fs/promises';
import { join, basename, extname } from 'path';

const OBSIDIAN_VAULT = 'C:\\Users\\Timf\\Documents\\Obsidian_Vault';
const PROJECTS_DIR = join(OBSIDIAN_VAULT, 'MySelf', 'Projects');

export interface ObsidianProject {
  filename: string;
  title: string;
  tags: string[];
  points: number | null;
  content: string;
  todos: TodoItem[];
  lastModified: string;
}

export interface TodoItem {
  text: string;
  done: boolean;
  line: number;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, unknown> = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of lines) {
    if (inArray) {
      const arrItem = line.match(/^\s+-\s+(.+)/);
      if (arrItem) {
        arrayValues.push(arrItem[1]);
        continue;
      } else {
        meta[currentKey] = [...arrayValues];
        arrayValues.length = 0;
        inArray = false;
      }
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === '') {
        inArray = true;
      } else {
        meta[currentKey] = val.replace(/^["']|["']$/g, '');
      }
    }
  }
  if (inArray) meta[currentKey] = [...arrayValues];

  return { meta, body: match[2] };
}

function extractTodos(body: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
    if (m) {
      todos.push({ text: m[2], done: m[1] !== ' ', line: i + 1 });
    }
  }
  return todos;
}

export async function getObsidianProjects(): Promise<ObsidianProject[]> {
  const projects: ObsidianProject[] = [];

  try {
    const entries = await readdir(PROJECTS_DIR);
    for (const entry of entries) {
      if (extname(entry) !== '.md') continue;
      const fullPath = join(PROJECTS_DIR, entry);
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) continue;

      const raw = await readFile(fullPath, 'utf-8');
      const { meta, body } = parseFrontmatter(raw);

      const tags = Array.isArray(meta.tags) ? meta.tags as string[] : [];
      const points = meta.points ? parseInt(meta.points as string, 10) : null;
      const todos = extractTodos(body);

      projects.push({
        filename: entry,
        title: basename(entry, '.md'),
        tags,
        points,
        content: body.trim(),
        todos,
        lastModified: fileStat.mtime.toISOString(),
      });
    }

    // Also read subdirectories (like Документация)
    for (const entry of entries) {
      const dirPath = join(PROJECTS_DIR, entry);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) continue;

      const subEntries = await readdir(dirPath);
      for (const sub of subEntries) {
        if (extname(sub) !== '.md') continue;
        const fullPath = join(dirPath, sub);
        const fileStat = await stat(fullPath);
        const raw = await readFile(fullPath, 'utf-8');
        const { meta, body } = parseFrontmatter(raw);
        const tags = Array.isArray(meta.tags) ? meta.tags as string[] : [];
        const points = meta.points ? parseInt(meta.points as string, 10) : null;
        const todos = extractTodos(body);

        projects.push({
          filename: `${entry}/${sub}`,
          title: basename(sub, '.md'),
          tags: [...tags, entry],
          points,
          content: body.trim(),
          todos,
          lastModified: fileStat.mtime.toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('Failed to read Obsidian vault:', e);
  }

  return projects.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

function resolveFilePath(filename: string): string {
  return join(PROJECTS_DIR, filename);
}

async function readRawFile(filename: string): Promise<string> {
  return readFile(resolveFilePath(filename), 'utf-8');
}

async function writeRawFile(filename: string, content: string): Promise<void> {
  await writeFile(resolveFilePath(filename), content, 'utf-8');
}

export async function toggleTodo(filename: string, todoLine: number): Promise<void> {
  const raw = await readRawFile(filename);
  const { body, meta } = parseFrontmatter(raw);
  const lines = body.split(/\r?\n/);
  const idx = todoLine - 1;
  if (idx < 0 || idx >= lines.length) return;

  lines[idx] = lines[idx].replace(
    /^([-*]\s+\[)([ xX])(\].*)$/,
    (_, pre, check, post) => `${pre}${check === ' ' ? 'x' : ' '}${post}`
  );

  await writeRawFile(filename, rebuildFile(meta, lines.join('\n')));
}

export async function deleteTodo(filename: string, todoLine: number): Promise<void> {
  const raw = await readRawFile(filename);
  const { body, meta } = parseFrontmatter(raw);
  const lines = body.split(/\r?\n/);
  const idx = todoLine - 1;
  if (idx < 0 || idx >= lines.length) return;

  lines.splice(idx, 1);
  await writeRawFile(filename, rebuildFile(meta, lines.join('\n')));
}

export async function addTodo(filename: string, text: string): Promise<void> {
  const raw = await readRawFile(filename);
  const { body, meta } = parseFrontmatter(raw);
  const lines = body.split(/\r?\n/);

  let lastTodoIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[-*]\s+\[[ xX]\]/.test(lines[i])) {
      lastTodoIdx = i;
      break;
    }
  }

  const newLine = `- [ ] ${text}`;
  if (lastTodoIdx >= 0) {
    lines.splice(lastTodoIdx + 1, 0, newLine);
  } else {
    lines.push('', newLine);
  }

  await writeRawFile(filename, rebuildFile(meta, lines.join('\n')));
}

export async function setPoints(filename: string, points: number): Promise<void> {
  const raw = await readRawFile(filename);
  const { body, meta } = parseFrontmatter(raw);
  meta.points = String(Math.max(0, Math.min(10, points)));
  await writeRawFile(filename, rebuildFile(meta, body));
}

export async function createProject(title: string, points: number, tags: string[]): Promise<void> {
  const filename = `${title}.md`;
  const meta: Record<string, unknown> = {
    tags: ['project', 'MySelf', 'active', ...tags],
    points: String(points),
  };
  await writeRawFile(filename, rebuildFile(meta, `\n## Задачи\n`));
}

export async function deleteProject(filename: string): Promise<void> {
  await unlink(resolveFilePath(filename));
}

function rebuildFile(meta: Record<string, unknown>, body: string): string {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      frontmatter += `${key}:\n`;
      for (const item of value) {
        frontmatter += `  - ${item}\n`;
      }
    } else {
      frontmatter += `${key}: "${value}"\n`;
    }
  }
  frontmatter += '---\n';
  return frontmatter + body;
}
