'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  DollarSign,
  Terminal,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/sessions', label: 'Sessions', icon: MessageSquare },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/data', label: 'Data', icon: Database },
];

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function Sidebar() {
  const pathname = usePathname();
  const { data: sourceInfo } = useSWR('/api/data-source', fetcher, { refreshInterval: 5000 });

  const isImported = sourceInfo?.active === 'imported';

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Terminal className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Claude Code</h1>
          <p className="text-[10px] text-muted-foreground">Analytics Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3">
        {isImported ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
              Imported
            </Badge>
            <p className="text-[10px] text-muted-foreground truncate">
              {sourceInfo?.importMeta?.exportedFrom || 'snapshot'}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Reading from ~/.claude/
          </p>
        )}
      </div>
    </aside>
  );
}
