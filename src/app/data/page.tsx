'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Upload,
  HardDrive,
  Cloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileArchive,
  ArrowRightLeft,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DataSourceInfo {
  active: 'live' | 'imported';
  hasImportedData: boolean;
  importMeta: {
    importedAt: string;
    exportedAt: string;
    exportedFrom: string;
    projectCount: number;
    sessionCount: number;
    fileCount: number;
    totalSize: number;
  } | null;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function DataPage() {
  const { data: sourceInfo, mutate: mutateSource } = useSWR<DataSourceInfo>('/api/data-source', fetcher);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        || `claude-code-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Export downloaded successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to export data.' });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setMessage({
        type: 'success',
        text: `Imported ${data.meta.projectCount} projects, ${data.meta.sessionCount} sessions. Dashboard switched to imported data.`,
      });
      mutateSource();
      // Revalidate all data
      mutate(() => true);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to import data.' });
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = '';
    }
  }, [mutateSource]);

  const handleSwitchSource = useCallback(async (source: 'live' | 'imported') => {
    setMessage(null);
    try {
      const res = await fetch('/api/data-source', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error('Failed to switch');
      mutateSource();
      mutate(() => true);
      setMessage({ type: 'success', text: `Switched to ${source === 'live' ? 'live (~/.claude/)' : 'imported'} data.` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to switch data source.' });
    }
  }, [mutateSource]);

  const handleClearImport = useCallback(async () => {
    setMessage(null);
    try {
      const res = await fetch('/api/import', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear');
      mutateSource();
      mutate(() => true);
      setMessage({ type: 'success', text: 'Imported data cleared. Switched back to live data.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear imported data.' });
    }
  }, [mutateSource]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Data Management</h1>
        <p className="text-sm text-muted-foreground">Export, import, and manage your dashboard data</p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Active Data Source */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Active Data Source
            </CardTitle>
            <Badge variant={sourceInfo?.active === 'live' ? 'default' : 'secondary'}>
              {sourceInfo?.active === 'live' ? 'Live' : 'Imported'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSwitchSource('live')}
              className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                sourceInfo?.active === 'live'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <HardDrive className={`h-5 w-5 ${sourceInfo?.active === 'live' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <p className="text-sm font-medium">Live Data</p>
                <p className="text-xs text-muted-foreground">Read from ~/.claude/ in real-time</p>
              </div>
              {sourceInfo?.active === 'live' && (
                <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
            <button
              onClick={() => sourceInfo?.hasImportedData && handleSwitchSource('imported')}
              disabled={!sourceInfo?.hasImportedData}
              className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                sourceInfo?.active === 'imported'
                  ? 'border-primary bg-primary/5'
                  : sourceInfo?.hasImportedData
                    ? 'border-border hover:border-primary/50'
                    : 'border-border/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <Cloud className={`h-5 w-5 ${sourceInfo?.active === 'imported' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <p className="text-sm font-medium">Imported Data</p>
                <p className="text-xs text-muted-foreground">
                  {sourceInfo?.hasImportedData ? 'View previously imported snapshot' : 'No imported data yet'}
                </p>
              </div>
              {sourceInfo?.active === 'imported' && (
                <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Export */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Download all your Claude Code data as a ZIP archive. Includes session logs,
              stats, history, plans, and todos. Load it on another machine or keep as a backup.
            </p>
            <div className="rounded-lg bg-accent/50 p-3 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Includes</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span>Session JSONL files</span>
                <span>Stats cache</span>
                <span>Prompt history</span>
                <span>Plans & Todos</span>
                <span>Settings</span>
                <span>Export metadata</span>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing export...
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4" />
                  Export as ZIP
                </>
              )}
            </button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a previously exported ZIP archive to view that data in the dashboard.
              The dashboard will switch to showing the imported data automatically.
            </p>

            {sourceInfo?.importMeta && (
              <div className="rounded-lg border border-border/50 p-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Current Import
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium">{sourceInfo.importMeta.exportedFrom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exported</span>
                    <span className="font-medium">
                      {new Date(sourceInfo.importMeta.exportedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projects</span>
                    <span className="font-medium">{sourceInfo.importMeta.projectCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessions</span>
                    <span className="font-medium">{sourceInfo.importMeta.sessionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">{formatBytes(sourceInfo.importMeta.totalSize)}</span>
                  </div>
                </div>
                <Separator />
                <button
                  onClick={handleClearImport}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear Imported Data
                </button>
              </div>
            )}

            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/50">
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {sourceInfo?.hasImportedData ? 'Replace with new ZIP' : 'Upload ZIP file'}
                </>
              )}
              <input
                type="file"
                accept=".zip"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
