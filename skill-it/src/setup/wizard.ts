/**
 * Setup Wizard - Interactive first-run configuration
 *
 * Guides user through:
 * 1. Creating config files from templates
 * 2. Setting up cv.md
 * 3. Initializing SQLite database
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';

const PROJECT_ROOT = getProjectRoot();

export async function runSetup(): Promise<void> {
  console.log('🚀 skill-it Setup Wizard\n');
  console.log('This wizard will initialize your job search pipeline.\n');

  // Step 1: Create required directories
  console.log('📁 Creating directories...');
  const dirs = ['config', 'data', 'reports', 'output', 'logs/audit', 'batch/tracker-additions', 'modes'];
  for (const dir of dirs) {
    const fullPath = join(PROJECT_ROOT, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true, mode: 0o700 });
      console.log(`  ✅ Created ${dir}/`);
    }
  }

  // Step 2: Copy config templates
  console.log('\n📄 Copying configuration templates...');
  copyIfMissing('config/profile.yml', 'config/profile.example.yml');
  copyIfMissing('portals.yml', 'templates/portals.example.yml');
  copyIfMissing('modes/_profile.md', 'modes/_profile.template.md');

  // Step 3: Create cv.md if missing
  console.log('\n📝 Setting up your CV...');
  const cvPath = join(PROJECT_ROOT, 'cv.md');
  if (!existsSync(cvPath)) {
    const templateCv = join(PROJECT_ROOT, 'templates', 'cv-template.md');
    if (existsSync(templateCv)) {
      writeFileSync(cvPath, readFileSync(templateCv, 'utf-8'));
      console.log(`  ✅ Created cv.md from template`);
    } else {
      // Fallback minimal CV
      writeFileSync(cvPath, `# Your CV\n\n## Summary\n\n## Experience\n\n## Skills\n\n## Education\n`);
      console.log(`  ✅ Created basic cv.md`);
    }
  } else {
    console.log(`  ℹ️  cv.md already exists (skipping)`);
  }

  // Step 4: Initialize database
  console.log('\n💾 Initializing database...');
  try {
    const { initializeDatabase } = await import('../database/index.js');
    initializeDatabase();
    console.log('  ✅ SQLite database ready (data/career_ops.db)');
  } catch (error) {
    console.error(`  ❌ Database init failed: ${error}`);
    throw error;
  }

  // Step 5: Set permissions
  console.log('\n🔒 Setting file permissions...');
  const sensitiveFiles = ['config/profile.yml', 'portals.yml', 'modes/_profile.md', 'data/career_ops.db'];
  for (const file of sensitiveFiles) {
    const fullPath = join(PROJECT_ROOT, file);
    if (existsSync(fullPath)) {
      try {
        // chmod 600 for files
        require('fs').chmodSync(fullPath, 0o600);
        console.log(`  ✅ ${file} (0o600)`);
      } catch {
        // Ignore permission errors
      }
    }
  }

  console.log('\n✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Edit cv.md with your actual resume');
  console.log('  2. Edit config/profile.yml with your details');
  console.log('  3. Edit portals.yml to customize company list');
  console.log('  4. Run: skill-it doctor (to verify)');
  console.log('  5. Run: skill-it evaluate "https://jobs.example.com/..."\n');

  logAudit('setup_completed', {});
}

function copyIfMissing(dest: string, source: string): void {
  const destPath = join(PROJECT_ROOT, dest);
  const sourcePath = join(PROJECT_ROOT, source);

  if (!existsSync(destPath)) {
    if (existsSync(sourcePath)) {
      writeFileSync(destPath, readFileSync(sourcePath, 'utf-8'));
      console.log(`  ✅ Created ${dest} from template`);
    } else {
      console.log(`  ⚠️  Template ${source} not found - ${dest} not created`);
    }
  } else {
    console.log(`  ℹ️  ${dest} already exists (skipping)`);
  }
}
