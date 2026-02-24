'use client';

import { useStats, useProjects } from '@/lib/hooks';
import { StatCard } from '@/components/cards/stat-card';
import { CostChart } from '@/components/charts/cost-chart';
import { formatCost, formatTokens } from '@/lib/format';
import { calculateCost, getModelDisplayName, getModelColor, MODEL_PRICING } from '@/config/pricing';
import { Coins, TrendingUp, Zap, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

export default function CostsPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  if (statsLoading || projectsLoading || !stats || !projects) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading cost data...</p>
        </div>
      </div>
    );
  }

  // Calculate cache savings
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  Object.entries(stats.modelUsage).forEach(([, usage]) => {
    totalCacheReadTokens += usage.cacheReadInputTokens;
    totalCacheWriteTokens += usage.cacheCreationInputTokens;
    totalInputTokens += usage.inputTokens;
    totalOutputTokens += usage.outputTokens;
  });

  // Estimated savings: if cache reads were full-price input tokens instead
  let cacheSavings = 0;
  Object.entries(stats.modelUsage).forEach(([model, usage]) => {
    const pricing = MODEL_PRICING[model];
    if (pricing) {
      const fullPriceCost = (usage.cacheReadInputTokens / 1_000_000) * pricing.inputPerMillion;
      const cachePriceCost = (usage.cacheReadInputTokens / 1_000_000) * pricing.cacheReadPerMillion;
      cacheSavings += fullPriceCost - cachePriceCost;
    }
  });

  // Cost by project
  const projectCosts = projects
    .filter(p => p.estimatedCost > 0)
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 10)
    .map(p => ({
      name: p.name,
      cost: parseFloat(p.estimatedCost.toFixed(2)),
    }));

  // Model cost breakdown
  const modelCosts = Object.entries(stats.modelUsage).map(([model, usage]) => ({
    name: getModelDisplayName(model),
    model,
    cost: usage.estimatedCost,
    color: getModelColor(model),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheRead: usage.cacheReadInputTokens,
    cacheWrite: usage.cacheCreationInputTokens,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cost Analytics</h1>
        <p className="text-sm text-muted-foreground">Understand your Claude Code spending</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Estimated Cost"
          value={formatCost(stats.estimatedCost)}
          subtitle="all time"
          icon={Coins}
        />
        <StatCard
          title="Cache Savings"
          value={formatCost(cacheSavings)}
          subtitle="saved via prompt caching"
          icon={Zap}
        />
        <StatCard
          title="Input Tokens"
          value={formatTokens(totalInputTokens)}
          icon={TrendingUp}
        />
        <StatCard
          title="Output Tokens"
          value={formatTokens(totalOutputTokens)}
          icon={Database}
        />
      </div>

      {/* Cost Over Time */}
      <CostChart data={stats.dailyModelTokens} />

      <div className="grid grid-cols-2 gap-4">
        {/* Cost by Project */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Cost by Project</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectCosts}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Model Cost Breakdown */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {modelCosts.map(item => (
                <div key={item.model} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-semibold">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold">{formatCost(item.cost)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pl-5">
                    <span>Input: {formatTokens(item.inputTokens)}</span>
                    <span>Output: {formatTokens(item.outputTokens)}</span>
                    <span>Cache Read: {formatTokens(item.cacheRead)}</span>
                    <span>Cache Write: {formatTokens(item.cacheWrite)}</span>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>

            {/* Cache Efficiency */}
            <div className="mt-4 rounded-lg bg-accent/50 p-4">
              <h4 className="text-xs font-semibold mb-2">Cache Efficiency</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cache Read Tokens</span>
                  <span className="font-medium">{formatTokens(totalCacheReadTokens)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cache Write Tokens</span>
                  <span className="font-medium">{formatTokens(totalCacheWriteTokens)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Estimated Savings</span>
                  <span className="font-bold text-green-600">{formatCost(cacheSavings)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Reference */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pricing Reference (per 1M tokens)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Input</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Output</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Cache Write</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Cache Read</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).slice(0, 3).map(([model, pricing]) => (
                  <tr key={model} className="border-b border-border/30">
                    <td className="py-2 font-medium">{getModelDisplayName(model)}</td>
                    <td className="py-2 text-right">${pricing.inputPerMillion}</td>
                    <td className="py-2 text-right">${pricing.outputPerMillion}</td>
                    <td className="py-2 text-right">${pricing.cacheWritePerMillion}</td>
                    <td className="py-2 text-right">${pricing.cacheReadPerMillion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
