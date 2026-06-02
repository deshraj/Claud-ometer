import { NextResponse } from 'next/server';
import { runQuery, updateVacancyStatus } from '@/lib/jobhunt/db';
import { QUERY_CATEGORIES } from '@/lib/jobhunt/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get('queryId');

  if (!queryId) {
    return NextResponse.json({ categories: QUERY_CATEGORIES });
  }

  for (const cat of QUERY_CATEGORIES) {
    const q = cat.queries.find(q => q.id === queryId);
    if (q) {
      try {
        const result = await runQuery(q.sql);
        return NextResponse.json({ query: q, ...result });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'Query not found' }, { status: 404 });
}

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }
    const ok = await updateVacancyStatus(Number(id), status);
    if (!ok) {
      return NextResponse.json({ error: 'Not found or invalid status' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sql } = await request.json();
    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ error: 'SQL required' }, { status: 400 });
    }

    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
      return NextResponse.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
    }

    const result = await runQuery(sql);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
