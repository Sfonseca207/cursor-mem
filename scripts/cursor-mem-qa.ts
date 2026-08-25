#!/usr/bin/env bun
/**
 * Live QA for the isolated cursor-mem worker (port 37850, ~/.cursor-mem).
 *
 *   bun scripts/cursor-mem-qa.ts
 *   bun scripts/cursor-mem-qa.ts --watch
 *   bun scripts/cursor-mem-qa.ts --fail-open
 */
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';
import {
  CURSOR_MEM_DATA_DIR,
  CURSOR_MEM_PORT,
  REPO_ROOT,
  WORKER_SCRIPT,
  runCursorHook,
  runWorkerCommand,
  workerBaseUrl,
} from './cursor-mem-runtime.ts';

const HEALTH_TIMEOUT_MS = 30_000;
const POLL_MS = 500;
const WATCH_INTERVAL_MS = 2_000;
const FETCH_TIMEOUT_MS = 5_000;
const MARKETPLACE_MARKER = 'marketplaces/thedotmack';
const DB_PATH = join(CURSOR_MEM_DATA_DIR, 'claude-mem.db');
const PROJECT_NAME = basename(REPO_ROOT);

interface HealthPayload {
  status?: string;
  version?: string;
  workerPath?: string;
  pid?: number;
  uptime?: number;
  initialized?: boolean;
  mcpReady?: boolean;
  ai?: unknown;
}

interface ReadinessPayload {
  status?: string;
  message?: string;
  mcpReady?: boolean;
}

function parseFlags(argv: string[]): { watch: boolean; failOpen: boolean } {
  return {
    watch: argv.includes('--watch'),
    failOpen: argv.includes('--fail-open'),
  };
}

async function fetchJson(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${workerBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHealth(): Promise<{ ok: boolean; status: number; body: HealthPayload | null }> {
  try {
    const result = await fetchJson('/api/health');
    const body = result.body && typeof result.body === 'object' ? result.body as HealthPayload : null;
    return { ok: result.ok, status: result.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

async function fetchReadiness(): Promise<{ ok: boolean; status: number; body: ReadinessPayload | null }> {
  try {
    const result = await fetchJson('/api/readiness');
    const body = result.body && typeof result.body === 'object' ? result.body as ReadinessPayload : null;
    return { ok: result.ok, status: result.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHealth(health: HealthPayload | null, readiness: ReadinessPayload | null): void {
  const path = health?.workerPath ?? '(none)';
  const ai = health?.ai === undefined ? '' : ` ai=${JSON.stringify(health.ai)}`;
  console.log(
    `  port=${CURSOR_MEM_PORT} pid=${health?.pid ?? '?'} version=${health?.version ?? '?'} ` +
      `health=${health?.status ?? 'down'} ready=${readiness?.status ?? 'down'}${ai}`,
  );
  console.log(`  workerPath=${path}`);
}

function assertWorkerPath(workerPath: string | undefined): void {
  if (!workerPath) {
    throw new Error('health.workerPath missing — cannot prove this checkout owns the process');
  }
  if (workerPath.includes(MARKETPLACE_MARKER)) {
    throw new Error(`workerPath is marketplace, not this repo: ${workerPath}`);
  }
  if (!workerPath.includes(REPO_ROOT) && workerPath !== WORKER_SCRIPT) {
    throw new Error(`workerPath is not this checkout (${REPO_ROOT}): ${workerPath}`);
  }
}

async function waitForReady(): Promise<{ health: HealthPayload; readiness: ReadinessPayload }> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastHealth: HealthPayload | null = null;
  let lastReady: ReadinessPayload | null = null;

  while (Date.now() < deadline) {
    const health = await fetchHealth();
    const readiness = await fetchReadiness();
    lastHealth = health.body;
    lastReady = readiness.body;
    if (health.body?.pid && health.body.workerPath && readiness.body?.status === 'ready') {
      return { health: health.body, readiness: readiness.body };
    }
    await sleep(POLL_MS);
  }

  throw new Error(
    `Worker not ready within ${HEALTH_TIMEOUT_MS}ms ` +
      `(health=${lastHealth?.status ?? 'none'}, ready=${lastReady?.status ?? 'none'}). ` +
      'If start exited silently, check that claude-mem is not disabled in ~/.claude/settings.json.',
  );
}

function startIsolatedWorker(): void {
  const result = runWorkerCommand('start');
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    throw result.error;
  }
  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    console.warn(
      '[qa] start produced no JSON. If the worker never becomes healthy, ' +
        'claude-mem may be disabled in ~/.claude/settings.json (start exits 0).',
    );
  } else {
    try {
      const parsed = JSON.parse(stdout.split('\n').filter(Boolean).pop() ?? '{}') as { status?: string; message?: string };
      if (parsed.status === 'error') {
        throw new Error(parsed.message ?? 'worker start returned status=error');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // non-JSON noise on stdout is fine
      } else {
        throw error;
      }
    }
  }
}

async function ingestGoldPath(): Promise<void> {
  const contentSessionId = `qa-${Date.now()}`;
  const prompt = 'cursor-mem-qa: record this isolated HTTP gold check';
  const init = await fetchJson('/api/sessions/init', {
    method: 'POST',
    body: JSON.stringify({
      contentSessionId,
      project: 'cursor-mem',
      prompt,
      platformSource: 'cursor',
      customTitle: 'cursor-mem QA',
    }),
  });
  console.log(`  init HTTP ${init.status} ${JSON.stringify(init.body)}`);
  if (!init.ok) {
    throw new Error(`session init failed: HTTP ${init.status}`);
  }
  const initBody = init.body as { skipped?: boolean; reason?: string; status?: string; sessionDbId?: number };
  if (initBody.skipped && initBody.reason !== 'duplicate') {
    throw new Error(`session init skipped: ${initBody.reason}`);
  }

  const observation = await fetchJson('/api/sessions/observations', {
    method: 'POST',
    body: JSON.stringify({
      contentSessionId,
      tool_name: 'Edit',
      platformSource: 'cursor',
      cwd: REPO_ROOT,
      tool_input: {
        file_path: join(REPO_ROOT, 'docs/start/runtime.md'),
        old_string: 'QA marker',
        new_string: 'QA marker (cursor-mem isolated ingest)',
      },
      tool_response: { success: true },
    }),
  });
  console.log(`  observation HTTP ${observation.status} ${JSON.stringify(observation.body)}`);
  if (!observation.ok) {
    throw new Error(`observation ingest failed: HTTP ${observation.status}`);
  }
  const obsBody = observation.body as { stored?: boolean; status?: string; reason?: string };
  if (obsBody.stored === false) {
    throw new Error(`observation not stored: ${obsBody.reason ?? 'unknown'}`);
  }
  if (obsBody.status === 'skipped') {
    console.log(`  observation skipped (${obsBody.reason}) — accepted`);
  } else if (obsBody.status !== 'queued' && obsBody.status !== undefined) {
    throw new Error(`unexpected observation status: ${obsBody.status}`);
  }

  try {
    const search = await fetchJson(
      `/api/search?query=${encodeURIComponent('cursor-mem-qa')}&platformSource=cursor&limit=5`,
    );
    const asText = JSON.stringify(search.body);
    if (!search.ok) {
      console.warn(`  search warn: HTTP ${search.status} (observer may be unconfigured)`);
    } else if (asText.includes('cursor-mem-qa') || asText.includes(contentSessionId)) {
      console.log('  search: hit (compressed or index already visible)');
    } else {
      console.warn('  search warn: no hit yet — pending observer is OK for this slice');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  search warn: ${message}`);
  }
}

interface SessionRow {
  id: number;
  content_session_id: string;
  platform_source: string | null;
  project: string | null;
}

function openIsolatedDb(): Database {
  return new Database(DB_PATH, { readonly: true });
}

function countSessions(db: Database): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM sdk_sessions').get() as { n: number };
  return row.n;
}

function findSession(db: Database, contentSessionId: string, platformSource: string): SessionRow | undefined {
  return db.prepare(
    `SELECT id, content_session_id, platform_source, project
     FROM sdk_sessions
     WHERE content_session_id = ? AND platform_source = ?`,
  ).get(contentSessionId, platformSource) as SessionRow | undefined;
}

function parseHookContinue(stdout: string): boolean {
  const lines = stdout.trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]) as { continue?: boolean };
      if (typeof parsed.continue === 'boolean') return parsed.continue;
    } catch {
      // keep looking
    }
  }
  return false;
}

function runCaptureHook(
  event: string,
  payload: Record<string, unknown>,
): { continue: boolean; stdout: string; status: number } {
  const result = runCursorHook(event, `${JSON.stringify(payload)}\n`);
  if (result.error) {
    throw result.error;
  }
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (stderr.trim()) {
    console.log(`  hook ${event} stderr: ${stderr.trim().slice(0, 400)}`);
  }
  return {
    continue: parseHookContinue(stdout),
    stdout,
    status: result.status ?? 1,
  };
}

function runIdentityHook(payload: Record<string, unknown>): { continue: boolean; stdout: string; status: number } {
  return runCaptureHook('session-init', payload);
}

function workerLogPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return join(CURSOR_MEM_DATA_DIR, 'logs', `claude-mem-${yyyy}-${mm}-${dd}.log`);
}

function logEnqueued(sessionDbId: number, snippet: string): boolean {
  const path = workerLogPath();
  let text = '';
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return false;
  }
  return text.split('\n').some((line) => line.includes(`sessionDbId=${sessionDbId}`) && line.includes(snippet));
}

function assertHookOk(event: string, hook: { continue: boolean; status: number; stdout: string }): void {
  console.log(`  hook ${event} exit=${hook.status} continue=${hook.continue} stdout=${hook.stdout.trim().slice(0, 160)}`);
  if (hook.status !== 0) {
    throw new Error(`hook cursor ${event} exited ${hook.status}`);
  }
  if (!hook.continue) {
    throw new Error(`hook cursor ${event} did not return continue:true`);
  }
}

async function captureGoldPath(): Promise<void> {
  const conversationId = crypto.randomUUID();
  const base = {
    conversation_id: conversationId,
    workspace_roots: [REPO_ROOT],
  };

  const init = runCaptureHook('session-init', {
    ...base,
    prompt: 'cursor-mem capture qa',
    hook_event_name: 'beforeSubmitPrompt',
  });
  assertHookOk('session-init', init);

  const shell = runCaptureHook('observation', {
    ...base,
    hook_event_name: 'afterShellExecution',
    command: 'echo cursor-mem-capture-qa',
    output: 'cursor-mem-capture-qa\n',
    duration: 8,
  });
  assertHookOk('observation-shell', shell);

  const mcp = runCaptureHook('observation', {
    ...base,
    hook_event_name: 'afterMCPExecution',
    tool_name: 'search',
    tool_input: { query: 'cursor-mem-capture-qa' },
    result_json: { hits: [] },
    duration: 12,
  });
  assertHookOk('observation-mcp', mcp);

  const fileEdit = runCaptureHook('file-edit', {
    ...base,
    hook_event_name: 'afterFileEdit',
    file_path: join(REPO_ROOT, 'docs/start/captura.md'),
    edits: [{ old_string: 'QA', new_string: 'QA capture' }],
  });
  assertHookOk('file-edit', fileEdit);

  const summarize = runCaptureHook('summarize', {
    ...base,
    hook_event_name: 'stop',
    status: 'completed',
    loop_count: 0,
  });
  assertHookOk('summarize', summarize);

  const missingFile = runCaptureHook('file-edit', {
    ...base,
    hook_event_name: 'afterFileEdit',
    edits: [{ old_string: 'a', new_string: 'b' }],
  });
  assertHookOk('file-edit-no-path', missingFile);

  const db = openIsolatedDb();
  try {
    const session = findSession(db, conversationId, 'cursor');
    if (!session) {
      throw new Error(`capture qa: no sdk_sessions row for ${conversationId}`);
    }
    const pendingCount = db.prepare(
      'SELECT COUNT(*) AS n FROM pending_messages WHERE content_session_id = ?',
    ).get(conversationId) as { n: number };
    console.log(`  sqlite session id=${session.id} pendingCount=${pendingCount.n}`);

    const required = [
      'tool=Bash(echo cursor-mem-capture-qa)',
      'tool=search(cursor-mem-capture-qa)',
      'tool=write_file',
      'type=summarize',
    ];
    const missing = required.filter((snippet) => !logEnqueued(session.id, snippet));
    if (missing.length > 0) {
      throw new Error(`capture qa: log missing ENQUEUED for sessionDbId=${session.id}: ${missing.join(', ')}`);
    }
    console.log('  worker log ENQUEUED Bash + search + write_file + summarize');
  } finally {
    db.close();
  }
}

async function identityGoldPath(): Promise<void> {
  const conversationId = crypto.randomUUID();
  const payload = {
    conversation_id: conversationId,
    workspace_roots: [REPO_ROOT],
    prompt: 'cursor-mem identity qa',
    hook_event_name: 'beforeSubmitPrompt',
  };

  const hook = runIdentityHook(payload);
  console.log(`  hook session-init exit=${hook.status} continue=${hook.continue} stdout=${hook.stdout.trim().slice(0, 200)}`);
  if (hook.status !== 0) {
    throw new Error(`hook cursor session-init exited ${hook.status}`);
  }
  if (!hook.continue) {
    throw new Error('hook cursor session-init did not return continue:true');
  }

  let db = openIsolatedDb();
  try {
    const cursorRow = findSession(db, conversationId, 'cursor');
    if (!cursorRow) {
      throw new Error(`no sdk_sessions row for conversation_id=${conversationId} platform_source=cursor`);
    }
    if (cursorRow.platform_source !== 'cursor') {
      throw new Error(`platform_source is ${cursorRow.platform_source}, expected cursor`);
    }
    if (cursorRow.project !== PROJECT_NAME) {
      throw new Error(`project is ${cursorRow.project}, expected ${PROJECT_NAME}`);
    }
    console.log(`  sqlite cursor row id=${cursorRow.id} project=${cursorRow.project}`);
    const cursorId = cursorRow.id;
    db.close();

    const claudeInit = await fetchJson('/api/sessions/init', {
      method: 'POST',
      body: JSON.stringify({
        contentSessionId: conversationId,
        project: PROJECT_NAME,
        prompt: 'same id, other platform',
        platformSource: 'claude',
      }),
    });
    if (!claudeInit.ok) {
      throw new Error(`claude twin init failed: HTTP ${claudeInit.status}`);
    }

    db = openIsolatedDb();
    const claudeRow = findSession(db, conversationId, 'claude');
    if (!claudeRow) {
      throw new Error('same conversation_id with platformSource=claude did not create a second row');
    }
    if (claudeRow.id === cursorId) {
      throw new Error('cursor and claude sessions collided on the same row');
    }
    console.log(`  sqlite claude twin id=${claudeRow.id} (no collision)`);
    const beforeSkip = countSessions(db);
    db.close();

    const skipHook = runIdentityHook({
      workspace_roots: [REPO_ROOT],
      prompt: 'no conversation id',
      hook_event_name: 'beforeSubmitPrompt',
    });
    if (skipHook.status !== 0) {
      throw new Error(`no-id hook exited ${skipHook.status}`);
    }
    if (!skipHook.continue) {
      throw new Error('no-id hook must continue:true (fail-open)');
    }

    db = openIsolatedDb();
    const afterSkip = countSessions(db);
    if (afterSkip !== beforeSkip) {
      throw new Error(`no-id hook created a session (count ${beforeSkip} → ${afterSkip})`);
    }
    console.log('  no-id hook skipped insert (continue:true)');
  } finally {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
}

async function runFailOpen(): Promise<void> {
  console.log('\n[qa] --fail-open: stopping isolated worker');
  const stop = runWorkerCommand('stop');
  if (stop.stdout) process.stdout.write(stop.stdout);
  if (stop.stderr) process.stderr.write(stop.stderr);

  const deadline = Date.now() + 10_000;
  let down = false;
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (!health.ok && health.status === 0) {
      down = true;
      break;
    }
    await sleep(POLL_MS);
  }
  if (!down) {
    throw new Error('health still answers after stop — fail-open check failed');
  }
  console.log('  health no responde en :37850');
  console.log('  Cursor seguiría (hooks fail-open: timeout / continue:true; memoria es best-effort).');
}

function claudeMemDefaultPort(): number {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 77;
  return 37700 + (uid % 100);
}

async function reportClaudeMemUntouched(): Promise<void> {
  const port = claudeMemDefaultPort();
  const home = join(homedir(), '.claude-mem');
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    console.log(`  claude-mem default :${port} still HTTP ${response.status} (untouched). data dir ${home} not used by this QA.`);
  } catch {
    console.log(`  claude-mem default :${port} not answering (ok if you were not running it). QA did not bind that port.`);
  }
}

async function runWatch(): Promise<void> {
  startIsolatedWorker();
  const first = await waitForReady();
  assertWorkerPath(first.health.workerPath);
  console.log('[qa] watch every 2s — Ctrl+C to stop\n');
  printHealth(first.health, first.readiness);

  const tick = async () => {
    const health = await fetchHealth();
    const readiness = await fetchReadiness();
    const stamp = new Date().toISOString();
    process.stdout.write(`\n${stamp}\n`);
    printHealth(health.body, readiness.body);
  };

  const interval = setInterval(() => {
    tick().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
    });
  }, WATCH_INTERVAL_MS);

  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(interval);
      resolve();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

async function runOneShot(failOpen: boolean): Promise<void> {
  console.log(`[qa] isolated worker ${workerBaseUrl()}`);
  console.log(`[qa] script ${WORKER_SCRIPT}`);
  startIsolatedWorker();
  const ready = await waitForReady();
  assertWorkerPath(ready.health.workerPath);
  printHealth(ready.health, ready.readiness);
  console.log(`  curl ${workerBaseUrl()}/api/health`);

  console.log('\n[qa] HTTP gold path (init + observation)');
  await ingestGoldPath();

  console.log('\n[qa] identity (hook cursor session-init)');
  await identityGoldPath();

  console.log('\n[qa] capture (observation / file-edit / summarize)');
  await captureGoldPath();

  await reportClaudeMemUntouched();

  if (failOpen) {
    await runFailOpen();
  } else {
    console.log('\n[qa] worker left running. npm run cursormem:stop to shut it down.');
    console.log('[qa] npm run cursormem:qa -- --watch   live health');
    console.log('[qa] npm run cursormem:qa -- --fail-open');
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.watch && flags.failOpen) {
    console.error('--watch and --fail-open cannot be combined');
    process.exit(1);
  }
  if (flags.watch) {
    await runWatch();
    return;
  }
  await runOneShot(flags.failOpen);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[qa] FAIL: ${message}`);
    process.exit(1);
  });
}
