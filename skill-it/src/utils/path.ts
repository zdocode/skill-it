/**
 * Path Safety - Simplified
 */
import { join } from 'path';

export function getProjectRoot(): string {
  // For CLI tool, simply use current working directory
  return process.env.PROJECT_ROOT || process.cwd();
}

export function safeResolve(base: string, userPath: string): string {
  const { resolve, realpathSync } = require('path');
  const { existsSync } = require('fs');
  
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
