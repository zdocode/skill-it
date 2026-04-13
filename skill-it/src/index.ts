#!/usr/bin/env node
/**
 * skill-it — Secure AI-powered job search pipeline
 * Minimal skeleton (stubs)
 */

import { Command } from 'commander';
import { getProjectRoot } from './utils/path.js';
import { logAudit } from './utils/logger.js';
import { initializeDatabase } from './database/index.js';

async function main() {
  console.log('skill-it v2.0.0 🔒');
  console.log('===========================\n');

  const program = new Command();

  program
    .name('skill-it')
    .description('Secure AI-powered job search pipeline')
    .version('2.0.0');

  program
    .command('evaluate [input]')
    .alias('oferta')
    .description('Evaluate a job offer (stub)')
    .action(async (input: string, options: { pdf?: boolean; track?: boolean }) => {
      logAudit('evaluate_start', { input: input?.substring(0, 200) });
      try {
        const { evaluateOffer } = await import('./evaluation/evaluator.js');
        const result = await evaluateOffer({
          source: input?.startsWith('http') ? 'url' : 'text',
          content: input || '',
          generatePdf: options.pdf ?? false,
          track: options.track ?? true,
        });
        console.log('\n✅ Evaluation complete');
        console.log(`Score: ${result.score}/5`);
        console.log(`Report: ${result.reportPath}`);
        if (result.pdfPath) console.log(`PDF: ${result.pdfPath}`);
        if (result.trackerEntry) console.log(`Tracker: #${result.trackerEntry.number}`);
        logAudit('evaluate_complete', { score: result.score, archetype: result.archetype });
      } catch (error) {
        console.error('❌ Failed:', error);
        logAudit('evaluate_error', { error: String(error) });
        process.exit(1);
      }
    });

  program
    .command('scan')
    .description('Scan configured portals for new job listings')
    .option('-c, --company <name>', 'Scan a specific company only')
    .option('-m, --maxOffers <number>', 'Maximum number of offers to process', '50')
    .action(async (options: { company?: string; maxOffers?: string }) => {
      logAudit('scan_start', options);
      try {
        const { runScan } = await import('./scanner/portal-scanner.js');
        const result = await runScan({
          company: options.company,
          maxOffers: options.maxOffers ? parseInt(options.maxOffers, 10) : 50,
        });
        console.log('\n✅ Scan complete');
        console.log(`Found: ${result.found}, New: ${result.new}`);
        logAudit('scan_complete', result);
      } catch (error) {
        console.error('❌ Scan failed:', error);
        logAudit('scan_error', { error: String(error) });
        process.exit(1);
      }
    });

  program
    .command('pdf')
    .description('Generate tailored PDF (stub)')
    .action(() => {
      logAudit('pdf', {});
      console.log('✅ PDF stub - Playwright + sanitized HTML');
    });

  program
    .command('batch')
    .description('Batch processing (stub)')
    .action(() => {
      logAudit('batch', {});
      console.log('✅ Batch stub - worker threads');
    });

  program
    .command('tracker')
    .description('View pipeline')
    .action(async () => {
      logAudit('tracker_view', {});
      const { getTracker, renderTable } = await import('./tracker/viewer.js');
      const apps = await getTracker();
      renderTable(apps);
    });

  program
    .command('verify')
    .description('Pipeline integrity')
    .action(async () => {
      const { verifyPipeline } = await import('./tracker/verifier.js');
      const report = await verifyPipeline();
      if (report.errors === 0) {
        console.log('✅ Pipeline clean');
      } else {
        console.log(`🔴 ${report.errors} errors, ${report.warnings} warnings`);
      }
    });

  program
    .command('setup')
    .description('Run setup wizard')
    .action(async () => {
      const { runSetup } = await import('./setup/wizard.js');
      await runSetup();
    });

  program
    .command('doctor')
    .description('System health check')
    .action(async () => {
      const { runDoctor } = await import('./utils/doctor.js');
      const result = await runDoctor();
      console.log('\nSystem checks:');
      for (const check of result.checks) {
        console.log(`${check.pass ? '✅' : '❌'} ${check.label}${check.fix ? ` → ${check.fix}` : ''}`);
      }
    });

  program
    .command('verify-security')
    .description('Security posture scan')
    .action(async () => {
      const { runSecurityChecks } = await import('./security/verify.js');
      const report = await runSecurityChecks();
      console.log('\n🔒 Security Score:', report.score);
      for (const check of report.checks) {
        console.log(`${check.pass ? '✅' : '❌'} ${check.message}`);
      }
    });

  program
    .command('maintenance')
    .description('Database maintenance')
    .action(async () => {
      const { runMaintenance } = await import('./database/maintenance.js');
      await runMaintenance();
    });

  await program.parseAsync(process.argv);
}

// Initialize - ensure directories exist
try {
  const baseDir = getProjectRoot();
  const { mkdirSync, existsSync } = await import('fs');
  const { join } = await import('path');
  
  const dirs = ['data', 'output', 'reports', 'logs/audit', 'batch/tracker-additions', 'config'];
  for (const dir of dirs) {
    const fullPath = join(baseDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true, mode: 0o700 });
    }
  }

  initializeDatabase();
  
  await main();
} catch (error) {
  console.error('Fatal:', error);
  process.exit(1);
}
