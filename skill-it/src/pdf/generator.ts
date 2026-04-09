/**
 * PDF Generator - Minimal stub
 */
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';

const PROJECT_ROOT = getProjectRoot();

export async function generatePdf(options: { jobUrl?: string; outputPath?: string }): Promise<string> {
  const outPath = options.outputPath || join(PROJECT_ROOT, 'output', `cv-${Date.now()}.pdf`);
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Stub: write placeholder
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, 'PDF_PLACEHOLDER');
  logAudit('pdf_generated', { path: outPath });
  return outPath;
}
