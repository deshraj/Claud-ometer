'use client';

import { use } from 'react';
import { useSessionDetail } from '@/lib/hooks';
import { formatCost, formatDuration, formatTokens } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Clock, GitBranch, MessageSquare, Wrench,
  User, Bot, Coins, Activity, Minimize2
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, isLoading } = useSessionDetail(id);

  if (isLoading || !session) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  const topTools = Object.entries(session.toolsUsed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sessions"
          className="rounded-lg border border-border p-1.5 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{session.projectName}</h1>
            {session.models.map(m => (
              <Badge key={m} variant="secondary" className="text-xs">
                {m}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{session.id.slice(0, 8)}</span>
            {session.gitBranch && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {session.gitBranch}
              </span>
            )}
            <span>{format(new Date(session.timestamp), 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-6 gap-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 text-center">
            <Clock className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{formatDuration(session.duration)}</p>
            <p className="text-[10px] text-muted-foreground">Duration</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 text-center">
            <MessageSquare className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{session.messageCount}</p>
            <p className="text-[10px] text-muted-foreground">Messages</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 text-center">
            <Wrench className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{session.toolCallCount}</p>
            <p className="text-[10px] text-muted-foreground">Tool Calls</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 text-center">
            <Activity className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{formatTokens(session.totalInputTokens + session.totalOutputTokens)}</p>
            <p className="text-[10px] text-muted-foreground">Tokens</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 text-center">
            <Coins className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{formatCost(session.estimatedCost)}</p>
            <p className="text-[10px] text-muted-foreground">Est. Cost</p>
          </CardContent>
        </Card>
        <Card className={`border-border/50 shadow-sm ${session.compaction.compactions + session.compaction.microcompactions > 0 ? 'border-amber-300/50 bg-amber-50/30' : ''}`}>
          <CardContent className="p-3 text-center">
            <Minimize2 className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{session.compaction.compactions + session.compaction.microcompactions}</p>
            <p className="text-[10px] text-muted-foreground">Compactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Conversation */}
        <div className="col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 max-h-[600px] overflow-y-auto">
              <div className="space-y-4">
                {session.messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${
                      msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {msg.role === 'user' ? 'You' : 'Claude'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.timestamp), 'h:mm:ss a')}
                        </span>
                        {msg.model && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {msg.model.includes('opus') ? 'Opus' : msg.model.includes('sonnet') ? 'Sonnet' : 'Haiku'}
                          </Badge>
                        )}
                        {msg.usage && (
                          <span className="text-[9px] text-muted-foreground">
                            {formatTokens((msg.usage.input_tokens || 0) + (msg.usage.output_tokens || 0))} tokens
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content}
                      </div>
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {msg.toolCalls.map((tool, j) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                              {tool.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Token Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Input Tokens</span>
                <span className="font-medium">{formatTokens(session.totalInputTokens)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Output Tokens</span>
                <span className="font-medium">{formatTokens(session.totalOutputTokens)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cache Read</span>
                <span className="font-medium">{formatTokens(session.totalCacheReadTokens)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cache Write</span>
                <span className="font-medium">{formatTokens(session.totalCacheWriteTokens)}</span>
              </div>
            </CardContent>
          </Card>

          {topTools.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Tools Used</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {topTools.map(([tool, count]) => (
                  <div key={tool} className="flex items-center justify-between">
                    <span className="text-xs font-mono truncate max-w-[150px]">{tool}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {count}x
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Compaction Details */}
          {(session.compaction.compactions > 0 || session.compaction.microcompactions > 0) && (
            <Card className="border-amber-300/50 bg-amber-50/30 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Minimize2 className="h-3.5 w-3.5" />
                  Context Compaction
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Full Compactions</span>
                  <span className="font-bold">{session.compaction.compactions}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Micro-compactions</span>
                  <span className="font-bold">{session.compaction.microcompactions}</span>
                </div>
                {session.compaction.totalTokensSaved > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Tokens Saved</span>
                      <span className="font-bold text-green-600">
                        {formatTokens(session.compaction.totalTokensSaved)}
                      </span>
                    </div>
                  </>
                )}
                {session.compaction.compactionTimestamps.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Timeline</span>
                      {session.compaction.compactionTimestamps.map((ts, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(ts), 'h:mm:ss a')}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{session.version}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium truncate max-w-[120px]">{session.projectName}</span>
              </div>
              {session.gitBranch && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Branch</span>
                  <span className="font-mono truncate max-w-[120px]">{session.gitBranch}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
