/**
 * Setup Wizard - Minimal stub
 */
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';

const PROJECT_ROOT = getProjectRoot();

export async function runSetup(): Promise<void> {
  console.log('🚀 Setup Wizard\n');
  
  // Create directories
  const dirs = ['config', 'data', 'reports', 'output', 'logs/audit'];
  for (const dir of dirs) {
    const full = join(PROJECT_ROOT, dir);
    if (!existsSync(full)) mkdirSync(full, { recursive: true, mode: 0o700 });
  }
  
  // Note: Would copy templates here
  console.log('✅ Directories created');
  console.log('\nNext: Edit config/profile.yml and cv.md');
  
  logAudit('setup_complete', {});
}
