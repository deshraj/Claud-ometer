'use client';

import { useState } from 'react';
import { useObsidianProjects } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, CheckCircle2, Circle, Star, FileText, EyeOff,
  Plus, Minus, Trash2, X,
} from 'lucide-react';
import { timeAgo } from '@/lib/format';
import type { ObsidianProject } from '@/lib/obsidian/reader';

export default function PlansPage() {
  const { data, isLoading, mutateObsidian } = useObsidianProjects();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState(5);

  if (isLoading || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <EyeOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Obsidian watcher is disabled</p>
          <p className="text-xs text-muted-foreground">Enable it in the sidebar to see your plans</p>
        </div>
      </div>
    );
  }

  const projects = data.projects;
  const topLevel = projects.filter(p => !p.filename.includes('/'));
  const docs = projects.filter(p => p.filename.includes('/'));

  const totalTodos = projects.reduce((sum, p) => sum + p.todos.length, 0);
  const doneTodos = projects.reduce((sum, p) => sum + p.todos.filter(t => t.done).length, 0);

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return;
    await mutateObsidian('create_project', { title: newTitle.trim(), points: newPoints });
    setNewTitle('');
    setNewPoints(5);
    setShowNewProject(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Plans & Projects</h1>
          <p className="text-sm text-muted-foreground">
            From Obsidian vault — {projects.length} notes, {totalTodos} tasks ({doneTodos} done)
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(!showNewProject)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-600"
        >
          {showNewProject ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showNewProject ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showNewProject && (
        <Card className="border-violet-500/30 shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Project name</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                  placeholder="New project title..."
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-violet-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setNewPoints(Math.max(0, newPoints - 1))}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{newPoints}</span>
                  <button
                    onClick={() => setNewPoints(Math.min(10, newPoints + 1))}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={handleCreateProject}
                disabled={!newTitle.trim()}
                className="rounded-lg bg-violet-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-600 disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              Project Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{topLevel.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{docs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Task Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">
              {totalTodos > 0 ? `${Math.round((doneTodos / totalTodos) * 100)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{doneTodos}/{totalTodos} tasks</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projects by Priority</h2>
        {topLevel.map(project => (
          <ProjectCard key={project.filename} project={project} mutateObsidian={mutateObsidian} />
        ))}
      </div>

      {docs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Documentation</h2>
          <div className="grid grid-cols-2 gap-3">
            {docs.map(doc => (
              <Card key={doc.filename} className="border-border/50 shadow-sm">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{doc.title}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(doc.lastModified)}</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {doc.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  mutateObsidian,
}: {
  project: ObsidianProject;
  mutateObsidian: (action: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [newTodo, setNewTodo] = useState('');
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [busy, setBusy] = useState(false);

  const doneCount = project.todos.filter(t => t.done).length;
  const totalCount = project.todos.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const contentPreview = project.content
    .split('\n')
    .filter(l => !l.startsWith('- [') && l.trim().length > 0 && !l.startsWith('#'))
    .slice(0, 2)
    .join(' ')
    .slice(0, 150);

  const act = async (action: string, payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await mutateObsidian(action, { filename: project.filename, ...payload }); }
    finally { setBusy(false); }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    await act('add_todo', { text: newTodo.trim() });
    setNewTodo('');
    setShowAddTodo(false);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header: title + priority controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{project.title}</span>

              {/* Priority +/- */}
              <div className="flex items-center gap-0">
                <button
                  onClick={() => act('set_points', { points: (project.points ?? 0) - 1 })}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Decrease priority"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-0.5 mx-0.5">
                  <Star className="h-2.5 w-2.5" />
                  {project.points ?? 0}
                </Badge>
                <button
                  onClick={() => act('set_points', { points: (project.points ?? 0) + 1 })}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Increase priority"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {project.tags.filter(t => t !== 'project' && t !== 'MySelf' && t !== 'active').map(tag => (
                <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
              ))}
            </div>

            {contentPreview && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{contentPreview}</p>
            )}

            {/* Todos */}
            <div className="mt-3 space-y-2">
              {totalCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {doneCount}/{totalCount}
                  </span>
                </div>
              )}

              <div className="space-y-0.5">
                {project.todos.map((todo) => (
                  <div key={todo.line} className="group flex items-center gap-2 text-xs rounded px-1 -mx-1 hover:bg-accent/50">
                    <button
                      onClick={() => act('toggle_todo', { line: todo.line })}
                      className="shrink-0"
                      title={todo.done ? 'Mark undone' : 'Mark done'}
                    >
                      {todo.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground hover:text-violet-400 transition-colors" />
                      )}
                    </button>
                    <span className={`flex-1 ${todo.done ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => act('delete_todo', { line: todo.line })}
                      className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-all"
                      title="Delete task"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add todo */}
              {showAddTodo ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTodo();
                      if (e.key === 'Escape') { setShowAddTodo(false); setNewTodo(''); }
                    }}
                    placeholder="New task..."
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-violet-500"
                    autoFocus
                  />
                  <button
                    onClick={handleAddTodo}
                    disabled={!newTodo.trim()}
                    className="rounded bg-violet-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-600 disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddTodo(false); setNewTodo(''); }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTodo(true)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors mt-1"
                >
                  <Plus className="h-3 w-3" />
                  Add task
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(project.lastModified)}</span>
            <button
              onClick={() => {
                if (confirm(`Delete project "${project.title}"?`)) {
                  act('delete_project', {});
                }
              }}
              className="rounded p-1 text-muted-foreground opacity-0 hover:opacity-100 hover:text-red-400 transition-all group-hover:opacity-100"
              title="Delete project"
              style={{ opacity: undefined }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
