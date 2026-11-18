import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { config } from '../config.js';
import { errorMessage } from './errors.js';
import { resolveInRoot } from './safe-path.js';

export type TerminalEvent =
  | { type: 'ready'; cwd: string }
  | { type: 'cwd'; cwd: string }
  | { type: 'command'; command: string; cwd: string }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number | null; signal: string | null; durationMs: number }
  | { type: 'error'; message: string }
  | { type: 'clear' };

/**
 * Splits a command line into tokens, honouring single and double quotes.
 * Exposed for tests.
 */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasContent = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      if (char === '\\' && quote === '"' && index + 1 < command.length) {
        index += 1;
        current += command[index] ?? '';
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      hasContent = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }

    if (char === ' ' || char === '\t') {
      if (hasContent) {
        tokens.push(current);
        current = '';
        hasContent = false;
      }
      continue;
    }

    current += char;
    hasContent = true;
  }

  if (hasContent) tokens.push(current);
  return tokens;
}

/**
 * Joins a workspace-relative cwd with a cd target. `..` at the root is clamped
 * to the root, so a session can never leave the workspace.
 */
export function resolveSessionCwd(current: string, target: string): string {
  const base = target.startsWith('/') ? [] : current.split('/').filter(Boolean);
  const parts = [...base];

  for (const segment of target.split('/').filter(Boolean)) {
    if (segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  return parts.join('/');
}

/** Environment handed to child processes. Secrets never reach user code. */
function buildEnvironment(cwdAbsolute: string): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'HOME',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'TMPDIR',
    'USER',
    'LOGNAME',
    'SHELL',
    'DISPLAY',
    'XDG_RUNTIME_DIR',
    'SSH_AUTH_SOCK',
  ];

  const environment: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (typeof value === 'string') environment[key] = value;
  }

  environment.TERM = 'xterm-256color';
  environment.COLORTERM = 'truecolor';
  environment.FORCE_COLOR = '1';
  environment.PWD = cwdAbsolute;
  environment.SAFARI_WORKSPACE = config.workspaceDir;
  return environment;
}

export class TerminalSession {
  private cwdRelative = '';
  private child: ChildProcess | null = null;
  private startedAt = 0;
  private outputBytes = 0;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(private readonly emit: (event: TerminalEvent) => void) {}

  get cwd(): string {
    return this.cwdRelative;
  }

  get busy(): boolean {
    return this.child !== null;
  }

  /** Announce the session so the client can draw its first prompt. */
  start(): void {
    this.emit({ type: 'ready', cwd: this.cwdRelative });
  }

  async run(rawCommand: string): Promise<void> {
    if (this.disposed) return;

    const command = rawCommand.replace(/\r$/, '').trim();
    if (command.length === 0) return;

    if (this.busy) {
      this.emit({ type: 'error', message: 'A command is already running. Press Ctrl+C to stop it.' });
      return;
    }

    if (command.length > 8000) {
      this.emit({ type: 'error', message: 'Command is too long' });
      return;
    }

    if (command === 'clear' || command === 'cls') {
      this.emit({ type: 'clear' });
      this.finish(0);
      return;
    }

    if (command === 'exit' || command === 'logout') {
      this.emit({
        type: 'stdout',
        data: 'Use the close button in the panel toolbar to end this session.\r\n',
      });
      this.finish(0);
      return;
    }

    // `cd` is the only builtin: the session tracks the working directory, so a
    // bare `cd` must be handled here. Compound commands (`cd x && y`) are left
    // to bash, which runs them in a subshell and does not persist the change.
    if (/^cd(\s|$)/.test(command) && !/[;&|<>]/.test(command)) {
      const tokens = tokenize(command);
      const ok = this.changeDirectory(tokens.slice(1).join(' '));
      this.finish(ok ? 0 : 1);
      return;
    }

    this.execute(command);
  }

  /** Emit a synthetic completion for builtins so clients can redraw the prompt. */
  private finish(code: number): void {
    this.emit({ type: 'exit', code, signal: null, durationMs: 0 });
  }

  private changeDirectory(target: string): boolean {
    const requested = target.trim() === '' || target.trim() === '~' ? '' : target.trim();

    if (requested.startsWith('/')) {
      this.emit({
        type: 'stderr',
        data: 'cd: paths outside the workspace are not allowed\r\n',
      });
      return false;
    }

    const next = resolveSessionCwd(this.cwdRelative, requested);
    const absolute = resolveInRoot(config.workspaceDir, next);
    let stats: fs.Stats;
    try {
      stats = fs.statSync(absolute);
    } catch {
      this.emit({ type: 'stderr', data: `cd: ${target}: No such file or directory\r\n` });
      return false;
    }
    if (!stats.isDirectory()) {
      this.emit({ type: 'stderr', data: `cd: ${target}: Not a directory\r\n` });
      return false;
    }

    this.cwdRelative = next;
    this.emit({ type: 'cwd', cwd: next });
    return true;
  }

  private execute(command: string): void {
    const absoluteCwd = resolveInRoot(config.workspaceDir, this.cwdRelative);
    this.emit({ type: 'command', command, cwd: this.cwdRelative });
    this.startedAt = Date.now();
    this.outputBytes = 0;

    let child: ChildProcess;
    try {
      child = spawn('/bin/bash', ['-c', command], {
        cwd: absoluteCwd,
        env: buildEnvironment(absoluteCwd),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.emit({ type: 'error', message: errorMessage(error) });
      this.emit({ type: 'exit', code: null, signal: null, durationMs: 0 });
      return;
    }

    this.child = child;

    child.stdout?.on('data', (chunk: Buffer) => this.forward(chunk, 'stdout'));
    child.stderr?.on('data', (chunk: Buffer) => this.forward(chunk, 'stderr'));

    child.on('error', (error) => {
      this.emit({ type: 'stderr', data: `${errorMessage(error)}\r\n` });
    });

    child.on('close', (code, signal) => {
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      this.child = null;
      if (this.disposed) return;
      this.emit({
        type: 'exit',
        code,
        signal: signal ?? null,
        durationMs: Date.now() - this.startedAt,
      });
    });

    this.timeoutHandle = setTimeout(() => {
      this.emit({
        type: 'error',
        message: `Command exceeded the ${Math.round(config.limits.maxCommandRuntimeMs / 60000)} minute limit and was stopped.`,
      });
      this.kill('SIGKILL');
    }, config.limits.maxCommandRuntimeMs);
    this.timeoutHandle.unref?.();
  }

  private forward(chunk: Buffer, stream: 'stdout' | 'stderr'): void {
    if (this.disposed) return;

    this.outputBytes += chunk.byteLength;
    if (this.outputBytes > config.limits.maxCommandOutputBytes) {
      this.emit({
        type: 'stderr',
        data: '\r\n[output limit reached — process stopped]\r\n',
      });
      this.kill('SIGKILL');
      return;
    }
    this.emit({ type: stream, data: chunk.toString('utf8') });
  }

  /** Send a signal to the whole process group (children included). */
  private kill(signal: NodeJS.Signals): void {
    const child = this.child;
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // Process already gone.
      }
    }
  }

  interrupt(): void {
    if (!this.busy) return;
    this.emit({ type: 'stdout', data: '^C\r\n' });
    this.kill('SIGINT');
    setTimeout(() => {
      if (this.busy) this.kill('SIGKILL');
    }, 2000).unref?.();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
    this.kill('SIGKILL');
    this.child = null;
  }
}
