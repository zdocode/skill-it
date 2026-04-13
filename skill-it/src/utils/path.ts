/**
 * Path Safety - Simplified
 */
import { join, resolve } from 'path';
import { existsSync } from 'fs';

export function getProjectRoot(): string {
  // For CLI tool, simply use current working directory
  return process.env.PROJECT_ROOT || process.cwd();
}

export function safeResolve(base: string, userPath: string): string {
  if (!userPath) throw new Error('Path cannot be empty');

  // Check for traversal sequences
  if (userPath.includes('..')) {
    throw new Error(`Path traversal denied: ${userPath}`);
  }

  const resolved = resolve(base, userPath);
  return resolved;
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
