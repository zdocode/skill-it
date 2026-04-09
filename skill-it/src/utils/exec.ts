/**
 * Exec wrapper - Minimal stub with basic typing
 */
import { spawn } from 'child_process';
import { realpathSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid: number;
  timedOut: boolean;
  memoryKilled: boolean;
}

export async function runCommand(
  command: string,
  args: string[] = [],
  options: any = {}
): Promise<ExecResult> {
  const cmdPath = resolveCommand(command);
  const env = { ...process.env, NODE_ENV: 'production' };
  
  return new Promise((resolve, reject) => {
    const child = spawn(cmdPath, args, {
      cwd: options.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    const timeoutHandle = options.timeout
      ? setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, options.timeout)
      : null;

    child.on('exit', (code, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({
        stdout: stdout.slice(0, 1 * 1024 * 1024),
        stderr: stderr.slice(0, 1 * 1024 * 1024),
        exitCode: code || 0,
        pid: child.pid!,
        timedOut,
        memoryKilled: false,
      });
    });

    child.on('error', reject);

    if (options.onStdin && child.stdin) {
      options.onStdin(child.stdin);
    }
  });
}

function resolveCommand(command: string): string {
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) {
    const resolved = realpathSync(command);
    const projectRoot = process.cwd();
    if (!resolved.startsWith(projectRoot)) {
      throw new Error(`Command outside project: ${command}`);
    }
    return resolved;
  }
  return command;
}

export async function runScript(scriptPath: string, args: string[] = []): Promise<ExecResult> {
  return runCommand(scriptPath, args);
}
