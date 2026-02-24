'use client';

import { use } from 'react';
import { useProjectSessions } from '@/lib/hooks';
import { formatTokens, formatCost, formatDuration, timeAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, GitBranch, MessageSquare, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = decodeURIComponent(id);
  const { data: sessions, isLoading } = useProjectSessions(projectId);

  const projectName = projectId.split('-').pop() || projectId;

  if (isLoading || !sessions) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  const totalCost = sessions.reduce((sum, s) => sum + s.estimatedCost, 0);
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.toolCallCount, 0);

  // Aggregate tool usage across sessions
  const toolUsage: Record<string, number> = {};
  sessions.forEach(s => {
    Object.entries(s.toolsUsed).forEach(([tool, count]) => {
      toolUsage[tool] = (toolUsage[tool] || 0) + count;
    });
  });
  const topTools = Object.entries(toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="rounded-lg border border-border p-1.5 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{projectName}</h1>
          <p className="text-sm text-muted-foreground">{sessions.length} sessions</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalMessages.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalToolCalls.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Tool Calls</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCost(totalCost)}</p>
            <p className="text-xs text-muted-foreground">Est. Cost</p>
          </CardContent>
        </Card>
      </div>

      {topTools.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Top Tools Used</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {topTools.map(([tool, count]) => (
                <div
                  key={tool}
                  className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5"
                >
                  <Wrench className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">{tool}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {sessions.map(session => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {session.models.map(m => (
                      <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {m}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      {session.id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {session.gitBranch && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {session.gitBranch}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(session.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount} messages
                    </span>
                    <span>{session.toolCallCount} tool calls</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatCost(session.estimatedCost)}</p>
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
