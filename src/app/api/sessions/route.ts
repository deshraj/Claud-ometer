import { NextResponse } from 'next/server';
import { getSessions, getProjectSessions, searchSessions } from '@/lib/claude-data/reader';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (query) {
      const sessions = searchSessions(query, limit);
      return NextResponse.json(sessions);
    }

    if (projectId) {
      const sessions = getProjectSessions(projectId);
      return NextResponse.json(sessions);
    }

    const sessions = getSessions(limit, offset);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
