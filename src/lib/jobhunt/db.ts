import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.JOBHUNT_DATABASE_URL || 'postgresql://jobhunt:jobhunt@localhost:5432/jobhunt',
      max: 3,
    });
  }
  return pool;
}

export async function runQuery(sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql);
    const columns = result.fields.map(f => f.name);
    return { columns, rows: result.rows };
  } finally {
    client.release();
  }
}

const VALID_STATUSES = ['new', 'reviewed', 'applied', 'rejected', 'saved'] as const;
type VacancyStatus = typeof VALID_STATUSES[number];

export async function updateVacancyStatus(id: number, status: VacancyStatus): Promise<boolean> {
  if (!VALID_STATUSES.includes(status)) return false;
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'UPDATE vacancies SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}
