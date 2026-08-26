#!/usr/bin/env bun
/**
 * Isolated cursor-mem worker launcher.
 * Never writes ~/.claude-mem. Always uses this checkout's worker-service.cjs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { formatPreflightBanner } from '../src/cli/cursor-mem-banner.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(SCRIPT_DIR, '..');
export const CURSOR_MEM_PORT = 37850;
export const CURSOR_MEM_DATA_DIR = join(homedir(), '.cursor-mem');
export const WORKER_SCRIPT = join(REPO_ROOT, 'plugin', 'scripts', 'worker-service.cjs');
export const HOOK_CLI = join(REPO_ROOT, 'src', 'services', 'worker-service.ts');
export const SETTINGS_PATH = join(CURSOR_MEM_DATA_DIR, 'settings.json');
export const RUNTIME_SCRIPT = join(SCRIPT_DIR, 'cursor-mem-runtime.ts');
export const WORKER_START_TIMEOUT_MS = 40_000;
export const WORKER_ENSURE_EVENTS = new Set(['ensure-start', 'context', 'session-init']);

export function workerBaseUrl(): string {
  return `http://127.0.0.1:${CURSOR_MEM_PORT}`;
}

export function shouldEnsureWorkerForHookEvent(event: string): boolean {
  return WORKER_ENSURE_EVENTS.has(event);
}

export function isolatedEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLAUDE_MEM_DATA_DIR: CURSOR_MEM_DATA_DIR,
    CLAUDE_MEM_WORKER_PORT: String(CURSOR_MEM_PORT),
    CLAUDE_MEM_WORKER_SCRIPT_PATH: WORKER_SCRIPT,
  };
}

export function ensureSettings(): void {
  mkdirSync(CURSOR_MEM_DATA_DIR, { recursive: true });
  if (existsSync(SETTINGS_PATH)) return;
  writeFileSync(
    SETTINGS_PATH,
    `${JSON.stringify({ CLAUDE_MEM_WORKER_PORT: String(CURSOR_MEM_PORT) }, null, 2)}\n`,
    'utf-8',
  );
}

export type WorkerCliCommand = 'start' | 'stop' | 'status';

export function runWorkerCommand(command: WorkerCliCommand): SpawnSyncReturns<string> {
  if (!existsSync(WORKER_SCRIPT)) {
    throw new Error(`Worker script missing: ${WORKER_SCRIPT}`);
  }
  ensureSettings();
  return spawnSync('bun', [WORKER_SCRIPT, command], {
    env: isolatedEnv(),
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    timeout: command === 'start' ? WORKER_START_TIMEOUT_MS : undefined,
  });
}

export async function probeIsolatedWorkerHealth(timeoutMs = 800): Promise<boolean> {
  try {
    const response = await fetch(`${workerBaseUrl()}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function parseWorkerStartSuccess(result: SpawnSyncReturns<string>): boolean {
  if (result.error) return false;
  const stdout = (result.stdout ?? '').trim();
  if (stdout) {
    try {
      const last = stdout.split('\n').filter(Boolean).pop() ?? '{}';
      const parsed = JSON.parse(last) as { status?: string };
      if (parsed.status === 'error') return false;
    } catch {
      // start may print non-JSON noise on stdout
    }
  }
  return (result.status ?? 1) === 0;
}

/** Idempotent: health ok → no-op; else `worker start` and re-probe. Fail-open (returns false). */
export async function ensureIsolatedWorkerRunning(): Promise<boolean> {
  if (await probeIsolatedWorkerHealth()) return true;
  const result = runWorkerCommand('start');
  if (!parseWorkerStartSuccess(result)) return false;
  return probeIsolatedWorkerHealth(2_000);
}

/** Same path Cursor uses: `bun scripts/cursor-mem-runtime.ts hook <event>`. */
export function runRuntimeHook(event: string, stdinJson: string): SpawnSyncReturns<string> {
  return spawnSync('bun', [RUNTIME_SCRIPT, 'hook', event], {
    env: isolatedEnv(),
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    input: stdinJson,
    timeout: WORKER_START_TIMEOUT_MS + 5_000,
  });
}

export function writePreflightBanner(text: string): void {
  try {
    writeFileSync('/dev/tty', `${text}\n`);
  } catch {
    process.stderr.write(`${text}\n`);
  }
}

export async function runPreflight(): Promise<number> {
  const ok = await ensureIsolatedWorkerRunning();
  writePreflightBanner(formatPreflightBanner(ok, CURSOR_MEM_PORT));
  return 0;
}

export function runCursorHook(event: string, stdinJson: string): SpawnSyncReturns<string> {
  const entry = existsSync(HOOK_CLI) ? HOOK_CLI : WORKER_SCRIPT;
  if (!existsSync(entry)) {
    throw new Error(`Hook entry missing: ${entry}`);
  }
  ensureSettings();
  return spawnSync('bun', [entry, 'hook', 'cursor', event], {
    env: isolatedEnv(),
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    input: stdinJson,
  });
}

function printSpawnResult(result: SpawnSyncReturns<string>): number {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function printUsage(): void {
  console.error('Usage: bun scripts/cursor-mem-runtime.ts start|stop|status|preflight|hook <event>');
}

function readStdinSync(): string {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

async function runHookCli(event: string): Promise<number> {
  const stdinJson = readStdinSync();
  if (shouldEnsureWorkerForHookEvent(event)) {
    await ensureIsolatedWorkerRunning();
  }
  if (event === 'ensure-start') {
    process.stdout.write('{"continue":true}\n');
    return 0;
  }
  return printSpawnResult(runCursorHook(event, stdinJson));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'hook') {
    const event = process.argv[3];
    if (!event) {
      printUsage();
      process.exit(1);
    }
    process.exit(await runHookCli(event));
  }

  if (command === 'preflight') {
    process.exit(await runPreflight());
  }

  if (command !== 'start' && command !== 'stop' && command !== 'status') {
    printUsage();
    process.exit(1);
  }

  console.error(`[cursor-mem] data=${CURSOR_MEM_DATA_DIR} port=${CURSOR_MEM_PORT}`);
  console.error(`[cursor-mem] script=${WORKER_SCRIPT}`);

  const result = runWorkerCommand(command);
  const exitCode = printSpawnResult(result);
  if (command === 'stop' && exitCode === 0) {
    console.log(`Worker parado en el puerto ${CURSOR_MEM_PORT}. Ya no está corriendo.`);
  }
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
