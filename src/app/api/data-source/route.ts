import { NextResponse } from 'next/server';
import {
  getActiveDataSource,
  hasImportedData,
  getImportMeta,
  setDataSource,
} from '@/lib/claude-data/data-source';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    active: getActiveDataSource(),
    hasImportedData: hasImportedData(),
    importMeta: getImportMeta(),
  });
}

export async function PUT(request: Request) {
  try {
    const { source } = await request.json();
    if (source !== 'live' && source !== 'imported') {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }
    if (source === 'imported' && !hasImportedData()) {
      return NextResponse.json({ error: 'No imported data available' }, { status: 400 });
    }
    setDataSource(source);
    return NextResponse.json({ active: source });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to switch data source' }, { status: 500 });
  }
}
