import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { getImportDir, setDataSource } from '@/lib/claude-data/data-source';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a .zip archive' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify it has the expected structure
    const hasClaudeData = Object.keys(zip.files).some(f => f.startsWith('claude-data/'));
    if (!hasClaudeData) {
      return NextResponse.json(
        { error: 'Invalid archive: missing claude-data/ directory. This doesn\'t look like a Claude Code Dashboard export.' },
        { status: 400 }
      );
    }

    const importDir = getImportDir();

    // Clean previous import
    if (fs.existsSync(importDir)) {
      fs.rmSync(importDir, { recursive: true, force: true });
    }
    fs.mkdirSync(importDir, { recursive: true });

    // Extract all files
    let fileCount = 0;
    let totalSize = 0;

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      const targetPath = path.join(importDir, relativePath);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const content = await zipEntry.async('nodebuffer');
      fs.writeFileSync(targetPath, content);
      fileCount++;
      totalSize += content.length;
    }

    // Read export metadata
    let exportMeta = { exportedAt: 'unknown', exportedFrom: 'unknown' };
    const metaPath = path.join(importDir, 'claude-data', 'export-meta.json');
    if (fs.existsSync(metaPath)) {
      exportMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    // Count projects and sessions
    const projectsDir = path.join(importDir, 'claude-data', 'projects');
    let projectCount = 0;
    let sessionCount = 0;
    if (fs.existsSync(projectsDir)) {
      const projects = fs.readdirSync(projectsDir);
      projectCount = projects.filter(p =>
        fs.statSync(path.join(projectsDir, p)).isDirectory()
      ).length;
      for (const project of projects) {
        const pDir = path.join(projectsDir, project);
        if (fs.statSync(pDir).isDirectory()) {
          sessionCount += fs.readdirSync(pDir).filter(f => f.endsWith('.jsonl')).length;
        }
      }
    }

    // Save import metadata
    const importMeta = {
      importedAt: new Date().toISOString(),
      exportedAt: exportMeta.exportedAt,
      exportedFrom: exportMeta.exportedFrom,
      projectCount,
      sessionCount,
      fileCount,
      totalSize,
    };
    fs.writeFileSync(path.join(importDir, 'meta.json'), JSON.stringify(importMeta, null, 2));

    // Switch to imported data source
    setDataSource('imported');

    return NextResponse.json({
      success: true,
      meta: importMeta,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { clearImportedData, setDataSource: setSource } = await import('@/lib/claude-data/data-source');
    setSource('live');
    clearImportedData();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear import error:', error);
    return NextResponse.json({ error: 'Failed to clear imported data' }, { status: 500 });
  }
}
