/**
 * Doctor - Minimal health check
 */
import { existsSync } from 'fs';
import { join } from 'path';

export async function runDoctor() {
  const base = process.env.PROJECT_ROOT || process.cwd();
  const checks: Array<{ pass: boolean; label: string; fix?: string }> = [];
  
  const major = parseInt(process.versions.node.split('.')[0]);
  checks.push({ pass: major >= 20, label: `Node.js >= 20 (v${process.versions.node})`, fix: 'Upgrade Node.js' });
  checks.push({ pass: existsSync(join(base, 'node_modules')), label: 'Dependencies installed', fix: 'npm install' });
  checks.push({ pass: existsSync(join(base, 'cv.md')), label: 'cv.md exists', fix: 'Create cv.md' });
  checks.push({ pass: existsSync(join(base, 'config', 'profile.yml')), label: 'config/profile.yml exists', fix: 'Run setup' });
  checks.push({ pass: existsSync(join(base, 'portals.yml')), label: 'portals.yml exists', fix: 'Run setup' });
  
  return { checks };
}
