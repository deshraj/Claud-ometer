import { NextResponse } from 'next/server';
import {
  getObsidianProjects,
  toggleTodo,
  deleteTodo,
  addTodo,
  setPoints,
  createProject,
  deleteProject,
} from '@/lib/obsidian/reader';
import { getWatcherState } from '@/lib/watcher-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const watchers = getWatcherState();
  if (!watchers.obsidian) {
    return NextResponse.json({ enabled: false, projects: [] });
  }

  try {
    const projects = await getObsidianProjects();
    return NextResponse.json({ enabled: true, projects });
  } catch (error) {
    console.error('Error reading Obsidian:', error);
    return NextResponse.json({ error: 'Failed to read Obsidian vault' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, filename, line, text, points, title, tags } = body;

    switch (action) {
      case 'toggle_todo':
        await toggleTodo(filename, line);
        break;
      case 'delete_todo':
        await deleteTodo(filename, line);
        break;
      case 'add_todo':
        await addTodo(filename, text);
        break;
      case 'set_points':
        await setPoints(filename, points);
        break;
      case 'create_project':
        await createProject(title, points ?? 5, tags ?? []);
        break;
      case 'delete_project':
        await deleteProject(filename);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const projects = await getObsidianProjects();
    return NextResponse.json({ enabled: true, projects });
  } catch (error) {
    console.error('Obsidian mutation error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
