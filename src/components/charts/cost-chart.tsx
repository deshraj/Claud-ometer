'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyModelTokens } from '@/lib/claude-data/types';
import { calculateCost, getModelDisplayName, getModelColor } from '@/config/pricing';
import { format, parseISO } from 'date-fns';

interface CostChartProps {
  data: DailyModelTokens[];
}

export function CostChart({ data }: CostChartProps) {
  const allModels = new Set<string>();
  data.forEach(d => Object.keys(d.tokensByModel).forEach(m => allModels.add(m)));

  const chartData = data.map(d => {
    const entry: Record<string, unknown> = {
      date: format(parseISO(d.date), 'MMM d'),
    };
    for (const model of allModels) {
      const tokens = d.tokensByModel[model] || 0;
      const cost = calculateCost(model, tokens * 0.1, tokens * 0.05, tokens * 0.5, tokens * 0.35);
      entry[getModelDisplayName(model)] = parseFloat(cost.toFixed(2));
    }
    return entry;
  });

  const modelNames = Array.from(allModels).map(getModelDisplayName);
  const uniqueNames = [...new Set(modelNames)];
  const modelColors: Record<string, string> = {};
  Array.from(allModels).forEach(m => {
    modelColors[getModelDisplayName(m)] = getModelColor(m);
  });

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Cost Over Time</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, '']}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
              />
              {uniqueNames.map(name => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={modelColors[name]}
                  fill={modelColors[name]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
