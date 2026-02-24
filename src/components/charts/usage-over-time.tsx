'use client';

import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyActivity } from '@/lib/claude-data/types';
import { format, parseISO } from 'date-fns';

interface UsageOverTimeProps {
  data: DailyActivity[];
}

type MetricKey = 'messageCount' | 'sessionCount' | 'toolCallCount';

const metrics: { key: MetricKey; label: string; color: string }[] = [
  { key: 'messageCount', label: 'Messages', color: '#D4764E' },
  { key: 'sessionCount', label: 'Sessions', color: '#6B8AE6' },
  { key: 'toolCallCount', label: 'Tool Calls', color: '#5CB87A' },
];

export function UsageOverTime({ data }: UsageOverTimeProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('messageCount');

  const chartData = data.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'MMM d'),
  }));

  const activeConfig = metrics.find(m => m.key === activeMetric)!;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Usage Over Time</CardTitle>
          <div className="flex gap-1">
            {metrics.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeMetric === m.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke={activeConfig.color}
                strokeWidth={2}
                fill={`url(#gradient-${activeMetric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
