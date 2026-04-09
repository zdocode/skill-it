/**
 * Tracker Verifier - Minimal
 */
import { getApplications } from '../database/index.js';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { logAudit } from '../utils/logger.js';

export async function verifyPipeline() {
  const apps = getApplications({ limit: 10000 });
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check canonical statuses
  const validStatuses = ['evaluated','applied','responded','interview','offer','rejected','discarded','skip'];
  for (const app of apps) {
    if (!validStatuses.includes(app.status)) {
      errors.push(`#${app.number}: invalid status "${app.status}"`);
    }
  }

  // Check duplicates
  const seen = new Map<string, number[]>();
  for (const app of apps) {
    const key = `${app.companySlug}::${app.roleSlug}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(app.number);
  }
  for (const [key, nums] of seen) {
    if (nums.length > 1) warnings.push(`Duplicates: #${nums.join(', #')} (${key})`);
  }

  console.log(`\n📊 Checked ${apps.length} entries`);
  console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}`);

  logAudit('pipeline_verified', { total: apps.length, errors: errors.length });

  return { total: apps.length, errors: errors.length, warnings: warnings.length, checks: [] };
}
