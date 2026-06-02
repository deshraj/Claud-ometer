import useSWR, { mutate as globalMutate } from 'swr';
import type { DashboardStats, ProjectInfo, SessionInfo, SessionDetail } from '@/lib/claude-data/types';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

export function useStats() {
  return useSWR<DashboardStats>('/api/stats', fetcher);
}

export function useProjects() {
  return useSWR<ProjectInfo[]>('/api/projects', fetcher);
}

export function useSessions(limit = 50, offset = 0, query = '') {
  const url = query
    ? `/api/sessions?q=${encodeURIComponent(query)}&limit=${limit}`
    : `/api/sessions?limit=${limit}&offset=${offset}`;
  return useSWR<SessionInfo[]>(url, fetcher);
}

export function useProjectSessions(projectId: string) {
  return useSWR<SessionInfo[]>(`/api/sessions?projectId=${projectId}`, fetcher);
}

export function useSessionDetail(sessionId: string) {
  return useSWR<SessionDetail>(`/api/sessions/${sessionId}`, fetcher);
}

export interface WatcherState {
  claude: boolean;
  obsidian: boolean;
}

export function useWatchers() {
  const swr = useSWR<WatcherState>('/api/watchers', fetcher, { refreshInterval: 5000 });

  const toggle = async (key: keyof WatcherState) => {
    if (!swr.data) return;
    const updated = { ...swr.data, [key]: !swr.data[key] };
    await fetch('/api/watchers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    globalMutate('/api/watchers');
  };

  return { ...swr, toggle };
}
