/**
 * Tracker Viewer - Minimal
 */
import chalk from 'chalk';
import { getApplications } from '../database/index.js';

export async function getTracker() {
  return getApplications({ limit: 100 });
}

export function renderTable(apps: any[]): void {
  if (apps.length === 0) {
    console.log(chalk.yellow('No applications found.'));
    return;
  }
  console.log('#  Date       Company              Role                         Score  Status');
  console.log('--- ---------- -------------------- ---------------------------- ------ --------');
  for (const app of apps) {
    const score = app.score !== null ? app.score.toFixed(2) + '/5' : 'N/A';
    console.log(`${app.number.toString().padStart(3)} ${app.date} ${app.company.padEnd(20)} ${app.role.padEnd(27)} ${score.padStart(6)} ${app.status}`);
  }
}

export function renderMarkdownTable(apps: any[]): string {
  if (apps.length === 0) return '# Applications\n\nNo entries yet.';
  const lines = ['# Applications', '', '| # | Date | Company | Role | Score | Status |', '|---|------|---------|------|-------|--------|'];
  for (const app of apps) {
    const score = app.score?.toFixed(2) ?? 'N/A';
    lines.push(`| ${app.number} | ${app.date} | ${app.company} | ${app.role} | ${score} | ${app.status} |`);
  }
  return lines.join('\n');
}
