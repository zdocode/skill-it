/**
 * Evaluation Engine - Minimal stub
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';
import { getNextApplicationNumber, initializeDatabase } from '../database/index.js';

const PROJECT_ROOT = getProjectRoot();

export interface EvaluationInput {
  source: 'url' | 'text';
  content: string;
  generatePdf: boolean;
  track: boolean;
}

export interface EvaluationResult {
  score: number;
  archetype: string;
  reportPath: string;
  pdfPath?: string;
  trackerEntry?: { number: number; company: string; role: string };
}

export async function evaluateOffer(input: EvaluationInput): Promise<EvaluationResult> {
  // Ensure DB is initialized before querying
  initializeDatabase();

  const jdText = input.source === 'url' ? `Fetched from ${input.content}` : input.content;
  const archetype = 'LLMOps'; // stub detection
  const score = 4.2; // stub score
  
  const reportNum = getNextApplicationNumber();
  const reportDate = new Date().toISOString().split('T')[0];
  const reportFilename = `${String(reportNum).padStart(3, '0')}-company-${reportDate}.md`;
  const reportPath = join('reports', reportFilename);
  
  const fullReport = `# Evaluation\n\n**Score:** ${score}/5\n**Archetype:** ${archetype}\n\n${jdText.substring(0, 200)}...\n`;
  
  const fullReportPath = join(PROJECT_ROOT, reportPath);
  const dir = dirname(fullReportPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(fullReportPath, fullReport);
  
  logAudit('evaluation_completed', { score, archetype, report: reportPath });
  
  return {
    score,
    archetype,
    reportPath,
    pdfPath: input.generatePdf ? join(PROJECT_ROOT, 'output', 'cv.pdf') : undefined,
    trackerEntry: input.track ? { number: reportNum, company: 'Company', role: 'Role' } : undefined,
  };
}
