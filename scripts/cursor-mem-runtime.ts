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

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(SCRIPT_DIR, '..');
export const CURSOR_MEM_PORT = 37850;
export const CURSOR_MEM_DATA_DIR = join(homedir(), '.cursor-mem');
export const WORKER_SCRIPT = join(REPO_ROOT, 'plugin', 'scripts', 'worker-service.cjs');
export const HOOK_CLI = join(REPO_ROOT, 'src', 'services', 'worker-service.ts');
export const SETTINGS_PATH = join(CURSOR_MEM_DATA_DIR, 'settings.json');

export function workerBaseUrl(): string {
  return `http://127.0.0.1:${CURSOR_MEM_PORT}`;
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
  });
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
  console.error('Usage: bun scripts/cursor-mem-runtime.ts start|stop|status|hook <event>');
}

function readStdinSync(): string {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function runHookCli(event: string): number {
  const stdinJson = readStdinSync();
  const result = runCursorHook(event, stdinJson);
  return printSpawnResult(result);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'hook') {
    const event = process.argv[3];
    if (!event) {
      printUsage();
      process.exit(1);
    }
    process.exit(runHookCli(event));
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
