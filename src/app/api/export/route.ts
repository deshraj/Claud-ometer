import { NextResponse } from 'next/server';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const claudeDir = path.join(os.homedir(), '.claude');

    if (!fs.existsSync(claudeDir)) {
      return NextResponse.json({ error: 'No Claude data found' }, { status: 404 });
    }

    const passthrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(passthrough);

    // Add stats-cache.json
    const statsPath = path.join(claudeDir, 'stats-cache.json');
    if (fs.existsSync(statsPath)) {
      archive.file(statsPath, { name: 'claude-data/stats-cache.json' });
    }

    // Add history.jsonl
    const historyPath = path.join(claudeDir, 'history.jsonl');
    if (fs.existsSync(historyPath)) {
      archive.file(historyPath, { name: 'claude-data/history.jsonl' });
    }

    // Add settings.json
    const settingsPath = path.join(claudeDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      archive.file(settingsPath, { name: 'claude-data/settings.json' });
    }

    // Add all project session JSONL files
    const projectsDir = path.join(claudeDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      const projects = fs.readdirSync(projectsDir);
      for (const project of projects) {
        const projectPath = path.join(projectsDir, project);
        if (!fs.statSync(projectPath).isDirectory()) continue;

        const files = fs.readdirSync(projectPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            archive.file(path.join(projectPath, file), {
              name: `claude-data/projects/${project}/${file}`,
            });
          }
        }

        // Add memory directory if exists
        const memoryDir = path.join(projectPath, 'memory');
        if (fs.existsSync(memoryDir)) {
          archive.directory(memoryDir, `claude-data/projects/${project}/memory`);
        }
      }
    }

    // Add plans
    const plansDir = path.join(claudeDir, 'plans');
    if (fs.existsSync(plansDir)) {
      archive.directory(plansDir, 'claude-data/plans');
    }

    // Add todos
    const todosDir = path.join(claudeDir, 'todos');
    if (fs.existsSync(todosDir)) {
      archive.directory(todosDir, 'claude-data/todos');
    }

    // Add export metadata
    const meta = {
      exportedAt: new Date().toISOString(),
      exportedFrom: os.hostname(),
      claudeVersion: 'unknown',
      platform: process.platform,
    };
    archive.append(JSON.stringify(meta, null, 2), { name: 'claude-data/export-meta.json' });

    archive.finalize();

    // Collect all chunks
    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `claude-code-data-${timestamp}.zip`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
