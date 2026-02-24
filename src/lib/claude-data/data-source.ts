import fs from 'fs';
import path from 'path';
import os from 'os';

const IMPORT_DIR = path.join(process.cwd(), '.dashboard-data');
const IMPORT_META = path.join(IMPORT_DIR, 'meta.json');

export interface ImportMeta {
  importedAt: string;
  exportedAt: string;
  exportedFrom: string;
  projectCount: number;
  sessionCount: number;
}

export function getImportDir(): string {
  return IMPORT_DIR;
}

export function hasImportedData(): boolean {
  return fs.existsSync(IMPORT_META);
}

export function getImportMeta(): ImportMeta | null {
  if (!fs.existsSync(IMPORT_META)) return null;
  return JSON.parse(fs.readFileSync(IMPORT_META, 'utf-8'));
}

export function getActiveDataSource(): 'live' | 'imported' {
  const flagPath = path.join(IMPORT_DIR, '.use-imported');
  if (fs.existsSync(flagPath) && hasImportedData()) return 'imported';
  return 'live';
}

export function setDataSource(source: 'live' | 'imported') {
  const flagPath = path.join(IMPORT_DIR, '.use-imported');
  if (source === 'imported') {
    if (!fs.existsSync(IMPORT_DIR)) fs.mkdirSync(IMPORT_DIR, { recursive: true });
    fs.writeFileSync(flagPath, '1');
  } else {
    if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
  }
}

export function clearImportedData() {
  if (fs.existsSync(IMPORT_DIR)) {
    fs.rmSync(IMPORT_DIR, { recursive: true, force: true });
  }
}

export function getLiveClaudeDir(): string {
  return path.join(os.homedir(), '.claude');
}
