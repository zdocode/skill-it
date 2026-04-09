/**
 * Logger - Minimal, compiles cleanly
 */
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const AUDIT_LOG_DIR = join(PROJECT_ROOT, 'logs', 'audit');

// Simple audit logger
class SimpleAudit {
  private seq = 0;
  private stream: any = null; // Use any to avoid WriteStream type issues
  
  log(op: string, meta: Record<string, unknown> = {}): void {
    this.seq++;
    const entry = { seq: this.seq, ts: new Date().toISOString(), op, meta };
    
    if (!this.stream) {
      if (!existsSync(AUDIT_LOG_DIR)) {
        mkdirSync(AUDIT_LOG_DIR, { recursive: true, mode: 0o700 });
      }
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(AUDIT_LOG_DIR, `audit-${date}.log`);
      this.stream = createWriteStream(logFile, { flags: 'a' });
    }
    
    this.stream.write(JSON.stringify(entry) + '\n');
  }
}

export const audit = new SimpleAudit();

export function logAudit(op: string, meta?: Record<string, unknown>): void {
  audit.log(op, meta || {});
}

// Simple app logger (stub without pino to avoid type issues)
export const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args),
};
