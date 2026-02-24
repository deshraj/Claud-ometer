'use client';

import { useSessions } from '@/lib/hooks';
import { formatCost, formatDuration, timeAgo, formatTokens } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, GitBranch, MessageSquare, FolderKanban, Minimize2 } from 'lucide-react';
import Link from 'next/link';

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSessions(100);

  if (isLoading || !sessions) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">{sessions.length} sessions</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {sessions.map(session => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-accent/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                      {session.projectName}
                    </span>
                    {session.models.map(m => (
                      <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {m}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {session.gitBranch && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <GitBranch className="h-3 w-3 flex-shrink-0" />
                        {session.gitBranch}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(session.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount} msgs
                    </span>
                    <span>{session.toolCallCount} tools</span>
                    <span>{formatTokens(session.totalInputTokens + session.totalOutputTokens)} tokens</span>
                    {(session.compaction.compactions + session.compaction.microcompactions) > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Minimize2 className="h-3 w-3" />
                        {session.compaction.compactions + session.compaction.microcompactions} compactions
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-semibold">{formatCost(session.estimatedCost)}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(session.timestamp)}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
