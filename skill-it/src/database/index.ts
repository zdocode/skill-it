/**
 * Database - Minimal SQLite wrapper
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, chmodSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const DB_PATH = join(PROJECT_ROOT, 'data', 'career_ops.db');

let db: Database.Database | null = null;

export type ApplicationStatus = 'evaluated' | 'applied' | 'responded' | 'interview' | 'offer' | 'rejected' | 'discarded' | 'skip';

export interface Application {
  id?: number;
  number: number;
  date: string;
  company: string;
  companySlug: string;
  role: string;
  roleSlug: string;
  score: number | null;
  status: ApplicationStatus;
  pdfPath: string | null;
  reportPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function initializeDatabase(): Database.Database {
  if (db) return db;
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  try { chmodSync(DB_PATH, 0o600); } catch {}
  
  // Simple schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      date TEXT NOT NULL,
      company TEXT NOT NULL,
      company_slug TEXT NOT NULL,
      role TEXT NOT NULL,
      role_slug TEXT NOT NULL,
      score REAL,
      status TEXT NOT NULL,
      report_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_unique ON applications(company_slug, role_slug);
  `);
  
  return db;
}

export function createApplication(data: {
  number: number;
  date: string;
  company: string;
  companySlug: string;
  role: string;
  roleSlug: string;
  score: number | null;
  status: ApplicationStatus;
  reportPath: string;
}): Application {
  const stmt = db!.prepare(`
    INSERT INTO applications (number, date, company, company_slug, role, role_slug, score, status, report_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  const row = stmt.get(
    data.number, data.date, data.company, data.companySlug.toLowerCase(),
    data.role, data.roleSlug.toLowerCase(), data.score, data.status, data.reportPath
  ) as any;
  return row as Application;
}

export function getApplications(filters?: { status?: ApplicationStatus; limit?: number }): Application[] {
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params: unknown[] = [];
  if (filters?.status) { query += ' AND status = ?'; params.push(filters.status); }
  query += ' ORDER BY date DESC, number DESC';
  if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
  const stmt = db!.prepare(query);
  return stmt.all(...params) as Application[];
}

export function getNextApplicationNumber(): number {
  const row = db!.prepare('SELECT COALESCE(MAX(number), 0) + 1 as next FROM applications').get() as { next: number };
  return row.next;
}

export function saveEvaluation(data: { applicationId: number; archetype: string; fullReport: string }): number {
  // Simplified - just log
  return 1;
}

// Simple audit logger for DB ops
function logAuditDb(op: string, meta: Record<string, unknown>): void {
  // Stub - would write to audit_log table
}

export default { initializeDatabase };
