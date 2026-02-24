import useSWR from 'swr';
import type { DashboardStats, ProjectInfo, SessionInfo, SessionDetail } from '@/lib/claude-data/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useStats() {
  return useSWR<DashboardStats>('/api/stats', fetcher);
}

export function useProjects() {
  return useSWR<ProjectInfo[]>('/api/projects', fetcher);
}

export function useSessions(limit = 50, offset = 0) {
  return useSWR<SessionInfo[]>(`/api/sessions?limit=${limit}&offset=${offset}`, fetcher);
}

export function useProjectSessions(projectId: string) {
  return useSWR<SessionInfo[]>(`/api/sessions?projectId=${projectId}`, fetcher);
}

export function useSessionDetail(sessionId: string) {
  return useSWR<SessionDetail>(`/api/sessions/${sessionId}`, fetcher);
}
