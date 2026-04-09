/**
 * Config Loader - Minimal
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname, resolve } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { safeResolve, getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';

const PROJECT_ROOT = getProjectRoot();

const ProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  targetRoles: z.array(z.string()),
});

export function loadProfile(): unknown {
  const path = safeResolve(PROJECT_ROOT, 'config/profile.yml');
  if (!existsSync(path)) throw new Error('profile.yml missing');
  const content = readFileSync(path, 'utf-8');
  const data = yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
  const result = ProfileSchema.parse(data);
  logAudit('config_loaded', { type: 'profile' });
  return result;
}

export function loadPortals(): unknown {
  const path = safeResolve(PROJECT_ROOT, 'portals.yml');
  if (!existsSync(path)) throw new Error('portals.yml missing');
  const content = readFileSync(path, 'utf-8');
  const data = yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
  logAudit('config_loaded', { type: 'portals' });
  return data;
}

export function loadCV(): string {
  const path = safeResolve(PROJECT_ROOT, 'cv.md');
  if (!existsSync(path)) throw new Error('cv.md missing');
  const content = readFileSync(path, 'utf-8');
  if (content.length > 100 * 1024) throw new Error('CV too large');
  logAudit('cv_loaded', { size: content.length });
  return content;
}

export function setupDefaultConfig(): void {
  const base = PROJECT_ROOT;
  const configDir = join(base, 'config');
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true, mode: 0o700 });

  // Copy templates if missing (actual implementation would copy files)
  logAudit('config_setup', {});
}

export function validateInstallation() {
  const base = PROJECT_ROOT;
  return [
    { pass: existsSync(join(base, 'cv.md')), label: 'cv.md' },
    { pass: existsSync(join(base, 'config', 'profile.yml')), label: 'profile.yml' },
    { pass: existsSync(join(base, 'portals.yml')), label: 'portals.yml' },
  ];
}

export function appDir(): string { return PROJECT_ROOT; }
export function ensureSecureDir(dirPath: string): void {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}
