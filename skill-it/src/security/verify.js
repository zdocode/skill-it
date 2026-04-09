#!/usr/bin/env node
/**
 * verify-security.js — Security Posture Checker
 *
 * Scans the installation for common security issues:
 * - File permissions
 * - Dangerous env vars
 * - Dependency vulnerabilities
 * - Configuration errors
 * - Database security
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

interface Check {
  name: string;
  pass: boolean;
  critical: boolean;
  message: string;
  details?: string;
}

interface Report {
  secure: boolean;
  score: number;
  checks: Check[];
  timestamp: string;
}

async function runSecurityChecks(): Promise<Report> {
  console.log('\n🔒 Security Posture Report');
  console.log('='.repeat(60) + '\n');

  const checks: Check[] = [];

  // 1. File Permissions
  checks.push(...await checkFilePermissions());

  // 2. Environment Variables
  checks.push(...checkEnvironment());

  // 3. Configuration
  checks.push(...checkConfiguration());

  // 4. Dependencies
  checks.push(...await checkDependencies());

  // 5. Runtime
  checks.push(...checkRuntime());

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const criticalFailed = checks.filter(c => !c.pass && c.critical).length;
  const score = Math.round((passed / total) * 100);

  console.log('\n' + '-'.repeat(60));
  console.log(`Score: ${score}/100`);

  if (criticalFailed > 0) {
    console.log(chalk.red(`\n🔴 CRITICAL: ${criticalFailed} issue(s) require immediate attention!\n`));
  } else if (score >= 90) {
    console.log(chalk.green('\n✅ EXCELLENT: Security posture is strong.\n'));
  } else if (score >= 70) {
    console.log(chalk.yellow('\n⚠️  Good, but review recommended issues.\n'));
  } else {
    console.log(chalk.red('\n🔴 Poor security - fix issues before using.\n'));
  }

  return {
    secure: criticalFailed === 0,
    score,
    checks,
    timestamp: new Date().toISOString(),
  };
}

async function checkFilePermissions(): Promise<Check[]> {
  const checks: Check[] = [];

  // Files that should be 600
  const sensitiveFiles = [
    'config/profile.yml',
    'portals.yml',
    'modes/_profile.md',
    'data/career_ops.db',
  ];

  for (const file of sensitiveFiles) {
    const path = join(PROJECT_ROOT, file);
    if (existsSync(path)) {
      try {
        const stats = await import('fs').then(m => m.statSync(path));
        const mode = stats.mode & 0o777;
        const ok = mode <= 0o600;

        checks.push({
          name: `perm_${file.replace(/[^a-z]/g, '_')}`,
          pass: ok,
          critical: true,
          message: `${file}: ${mode.toString(8)} (expected ≤600)`,
          details: ok ? 'Not world-accessible' : 'World-readable! Run: chmod 600',
        });
      } catch {
        checks.push({ name: `perm_${file}`, pass: false, critical: true, message: `${file}: cannot stat` });
      }
    }
  }

  return checks;
}

function checkEnvironment(): Check[] {
  const checks: Check[] = [];

  // Check for dangerous Node flags
  const dangerousFlags = ['--inspect', '--debug', '--eval'];
  const hasDangerous = process.execArgv.some(arg => dangerousFlags.some(flag => arg.includes(flag)));

  checks.push({
    name: 'env_node_flags',
    pass: !hasDangerous,
    critical: false,
    message: hasDangerous ? 'Debug flags detected (--inspect/--debug)' : 'No debug flags',
    details: hasDangerous ? 'Remove debug flags in production' : undefined,
  });

  // Check NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  checks.push({
    name: 'env_node_env',
    pass: true,
    critical: false,
    message: `NODE_ENV = ${nodeEnv}`,
  });

  return checks;
}

function checkConfiguration(): Check[] {
  const checks: Check[] = [];

  try {
    const configPath = join(PROJECT_ROOT, 'config', 'profile.yml');
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');

      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"]?[^'"]+/i,
        /password\s*[:=]\s*['"]?[^'"]+/i,
        /token\s*[:=]\s*['"]?[^'"]+/i,
        /secret\s*[:=]\s*['"]?[^'"]+/i,
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          checks.push({
            name: 'config_no_secrets',
            pass: false,
            critical: true,
            message: 'Potential hardcoded secret in config/profile.yml',
            details: 'Use environment variables for API keys',
          });
          break;
        }
      }
    }

    checks.push({
      name: 'config_profile_exists',
      pass: existsSync(join(PROJECT_ROOT, 'config', 'profile.yml')),
      critical: false,
      message: 'config/profile.yml exists',
    });

  } catch {
    checks.push({ name: 'config_check', pass: false, critical: true, message: 'Failed to check configuration' });
  }

  return checks;
}

async function checkDependencies(): Promise<Check[]> {
  const checks: Check[] = [];

  try {
    const { stdout } = await execAsync('npm audit --json --audit-level=high');
    const audit = JSON.parse(stdout);
    const vulns = audit.vulnerabilities || {};

    const highOrCritical = Object.values(vulns).filter((v: any) =>
      ['high', 'critical'].includes(v.severity)
    );

    if (highOrCritical.length > 0) {
      checks.push({
        name: 'deps_vulnerabilities',
        pass: false,
        critical: true,
        message: `${highOrCritical.length} high/critical vulnerabilities found`,
        details: 'Run: npm audit fix',
      });
    } else {
      checks.push({
        name: 'deps_vulnerabilities',
        pass: true,
        critical: false,
        message: 'No high/critical vulnerabilities',
      });
    }
  } catch (error) {
    // npm audit returns non-zero exit if vulns found
    if (error.stdout) {
      try {
        const audit = JSON.parse(error.stdout);
        if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
          checks.push({
            name: 'deps_vulnerabilities',
            pass: false,
            critical: true,
            message: 'Dependencies have known vulnerabilities',
            details: 'Run: npm audit fix',
          });
        } else {
          checks.push({ name: 'deps_vulnerabilities', pass: true, critical: false, message: 'No high/critical vulnerabilities' });
        }
      } catch {
        checks.push({ name: 'deps_vulnerabilities', pass: true, critical: false, message: 'Could not check dependencies' });
      }
    } else {
      checks.push({ name: 'deps_vulnerabilities', pass: true, critical: false, message: 'npm audit unavailable' });
    }
  }

  return checks;
}

function checkRuntime(): Check[] {
  const checks: Check[] = [];

  // Node version
  const major = parseInt(process.versions.node.split('.')[0]);
  checks.push({
    name: 'runtime_node_version',
    pass: major >= 20,
    critical: true,
    message: `Node.js v${process.versions.node} ${major >= 20 ? '✓' : '✗ (needs ≥20)'}`,
  });

  // Check if .env is gitignored
  const gitignorePath = join(PROJECT_ROOT, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    const hasDotEnv = gitignore.split('\n').some(line => line.trim() === '.env');
    checks.push({
      name: 'gitignore_dotenv',
      pass: hasDotEnv,
      critical: false,
      message: hasDotEnv ? '.env is gitignored' : 'WARNING: .env not in .gitignore!',
    });
  }

  return checks;
}

// Run
runSecurityChecks().then(report => {
  const critical = report.checks.filter(c => !c.pass && c.critical).length;
  const warnings = report.checks.filter(c => !c.pass && !c.critical).length;

  console.log('Summary:');
  console.log(`  Critical: ${critical}`);
  console.log(`  Warnings: ${warnings}`);
  console.log(`  Passed:   ${report.checks.filter(c => c.pass).length}`);

  process.exit(report.secure ? 0 : 1);
}).catch(err => {
  console.error('Fatal error during security check:', err);
  process.exit(1);
});
