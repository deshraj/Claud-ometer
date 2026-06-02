'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Briefcase, Play, ExternalLink, ChevronDown, ChevronRight,
  Code2, Globe, Archive, Database as DatabaseIcon, Search,
  CheckCircle2, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import type { QueryCategory, SavedQuery } from '@/lib/jobhunt/queries';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

const COLORS = [
  '#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f59e0b',
];

const CATEGORY_ICONS: Record<string, typeof Briefcase> = {
  overview: DatabaseIcon,
  targets: Briefcase,
  geography: Globe,
  stack: Code2,
  reserve: Archive,
  sources: Search,
};

export default function JobHuntPage() {
  const { data, isLoading } = useSWR<{ categories: QueryCategory[] }>('/api/jobhunt', fetcher);

  if (isLoading || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Connecting to JobHunt DB...</p>
        </div>
      </div>
    );
  }

  const categories = data.categories;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">JobHunt</h1>
        <p className="text-sm text-muted-foreground">
          Database queries — {categories.reduce((s, c) => s + c.queries.length, 0)} saved queries
        </p>
      </div>

      <Tabs defaultValue="vacancies">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="vacancies" className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Вакансии
          </TabsTrigger>
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id] || DatabaseIcon;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 text-xs">
                <Icon className="h-3 w-3" />
                {cat.name}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="custom" className="gap-1.5 text-xs">
            <Code2 className="h-3 w-3" />
            SQL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vacancies" className="mt-4">
          <VacancyList />
        </TabsContent>

        {categories.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-3 mt-4">
            {cat.queries.map(query => (
              <QueryCard key={query.id} query={query} />
            ))}
          </TabsContent>
        ))}

        <TabsContent value="custom" className="mt-4">
          <CustomQueryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface VacancyRow {
  id: number;
  title: string;
  company: string;
  country: string;
  city: string;
  relevance_score: number;
  status: string;
  work_format: string;
  url: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reviewed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  applied: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  saved: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

function VacancyList() {
  const [filter, setFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  const sql = `SELECT id, title, company, country, city, relevance_score, status,
       work_format, url, created_at::text
FROM vacancies
WHERE archived_at IS NULL
ORDER BY created_at DESC
LIMIT 200`;

  const { data, isLoading, error, mutate } = useSWR<{ columns: string[]; rows: VacancyRow[] }>(
    'jobhunt-vacancies',
    () => fetch('/api/jobhunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    }).then(r => r.json()),
  );

  const toggleApplied = useCallback(async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'applied' ? 'new' : 'applied';
    setUpdating(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/jobhunt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      mutate();
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [mutate]);

  const setStatus = useCallback(async (id: number, status: string) => {
    setUpdating(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/jobhunt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed');
      mutate();
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [mutate]);

  const rows = data?.rows ?? [];
  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Вакансии</CardTitle>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent/80"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${
              filter === 'all' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'border-border text-muted-foreground hover:border-border/80'
            }`}
          >
            Все ({rows.length})
          </button>
          {['new', 'reviewed', 'applied', 'saved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${
                filter === s ? STATUS_COLORS[s] : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 rounded-md p-2 mb-3">
            {error instanceof Error ? error.message : 'Failed to load'}
          </div>
        )}
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-10">Applied</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Вакансия</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Компания</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Локация</th>
                  <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Статус</th>
                  <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Формат</th>
                  <th className="px-3 py-1.5 text-center font-medium text-muted-foreground w-10">Link</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${
                    row.status === 'applied' ? 'bg-green-500/5' : ''
                  }`}>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.status === 'applied'}
                        disabled={updating.has(row.id)}
                        onChange={() => toggleApplied(row.id, row.status)}
                        className="h-4 w-4 rounded border-border accent-green-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-1.5 max-w-[250px] truncate font-medium">{row.title}</td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate">{row.company}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {[row.country, row.city].filter(Boolean).join(', ')}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`font-mono ${
                        row.relevance_score >= 70 ? 'text-green-400' :
                        row.relevance_score >= 40 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}>
                        {row.relevance_score}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <select
                        value={row.status}
                        disabled={updating.has(row.id)}
                        onChange={e => setStatus(row.id, e.target.value)}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] outline-none focus:border-orange-500 cursor-pointer disabled:opacity-50"
                      >
                        {['new', 'reviewed', 'applied', 'saved', 'rejected'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                      {row.work_format !== 'unknown' ? row.work_format : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300">
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      Нет вакансий
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueryCard({ query }: { query: SavedQuery }) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobhunt?queryId=${query.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {query.name}
          </button>
          <div className="flex items-center gap-2">
            {query.chartType && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {query.chartType}
              </Badge>
            )}
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {loading ? '...' : 'Run'}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          <pre className="text-[10px] text-muted-foreground bg-accent/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
            {query.sql.trim()}
          </pre>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 rounded-md p-2">{error}</div>
          )}

          {result && <ResultTable columns={result.columns} rows={result.rows} chartType={query.chartType} />}
        </CardContent>
      )}
    </Card>
  );
}

function CustomQueryCard() {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobhunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold">Произвольный SQL</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-3">
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="SELECT ..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-orange-500 min-h-[100px] resize-y"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Ctrl+Enter to run. Only SELECT queries.</span>
          <button
            onClick={run}
            disabled={loading || !sql.trim()}
            className="flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 rounded-md p-2">{error}</div>
        )}

        {result && <ResultTable columns={result.columns} rows={result.rows} />}
      </CardContent>
    </Card>
  );
}

function ResultTable({
  columns,
  rows,
  chartType,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  chartType?: 'bar' | 'pie' | 'none';
}) {
  const hasChart = chartType && chartType !== 'none' && rows.length > 0 && columns.length >= 2;
  const labelCol = columns[0];
  const valueCol = columns.find(c => c === 'count') || columns[columns.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {rows.length} rows
        </Badge>
      </div>

      {hasChart && chartType === 'bar' && (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.slice(0, 20)} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                dataKey={labelCol}
                tick={{ fontSize: 10, fill: '#888' }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey={valueCol} fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasChart && chartType === 'pie' && (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey={valueCol}
                nameKey={labelCol}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(props) => `${props.name ?? ''} ${(Number(props.percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              {columns.map(col => (
                <th key={col} className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                {columns.map(col => {
                  const val = row[col];
                  const isUrl = typeof val === 'string' && val.startsWith('http');
                  return (
                    <td key={col} className="px-3 py-1.5 max-w-[300px] truncate">
                      {isUrl ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
                        >
                          link <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        String(val ?? '')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
