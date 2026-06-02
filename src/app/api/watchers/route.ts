import { NextResponse } from 'next/server';
import { getWatcherState, setWatcherState } from '@/lib/watcher-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getWatcherState());
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const updated = setWatcherState(body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
