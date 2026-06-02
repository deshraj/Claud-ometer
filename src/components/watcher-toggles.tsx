'use client';

import { useWatchers } from '@/lib/hooks';
import { Eye, EyeOff, BookOpen, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WatcherToggles() {
  const { data, toggle } = useWatchers();

  if (!data) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Watchers</p>
      <button
        onClick={() => toggle('claude')}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
          data.claude
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent'
        )}
      >
        <Terminal className="h-3 w-3" />
        <span className="flex-1 text-left">Claude</span>
        {data.claude ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 opacity-50" />}
      </button>
      <button
        onClick={() => toggle('obsidian')}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
          data.obsidian
            ? 'bg-violet-500/10 text-violet-400'
            : 'text-muted-foreground hover:bg-accent'
        )}
      >
        <BookOpen className="h-3 w-3" />
        <span className="flex-1 text-left">Obsidian</span>
        {data.obsidian ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 opacity-50" />}
      </button>
    </div>
  );
}
