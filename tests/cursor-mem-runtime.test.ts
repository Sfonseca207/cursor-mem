import { describe, it, expect } from 'bun:test';
import {
  parseWorkerStartSuccess,
  shouldEnsureWorkerForHookEvent,
} from '../scripts/cursor-mem-runtime.ts';
import type { SpawnSyncReturns } from 'child_process';

function spawnResult(partial: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [],
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
    error: undefined,
    ...partial,
  } as SpawnSyncReturns<string>;
}

describe('isolated worker auto-start', () => {
  it('ensure-start, context and session-init boot the worker; capture hooks do not', () => {
    expect(shouldEnsureWorkerForHookEvent('ensure-start')).toBe(true);
    expect(shouldEnsureWorkerForHookEvent('context')).toBe(true);
    expect(shouldEnsureWorkerForHookEvent('session-init')).toBe(true);
    expect(shouldEnsureWorkerForHookEvent('observation')).toBe(false);
    expect(shouldEnsureWorkerForHookEvent('file-edit')).toBe(false);
    expect(shouldEnsureWorkerForHookEvent('summarize')).toBe(false);
  });

  it('parseWorkerStartSuccess accepts ready JSON and rejects status=error', () => {
    expect(parseWorkerStartSuccess(spawnResult({
      status: 0,
      stdout: '{"status":"ready"}\n',
    }))).toBe(true);
    expect(parseWorkerStartSuccess(spawnResult({
      status: 0,
      stdout: '{"status":"error","message":"Failed to start worker"}\n',
    }))).toBe(false);
    expect(parseWorkerStartSuccess(spawnResult({
      status: 1,
      stdout: '',
    }))).toBe(false);
    expect(parseWorkerStartSuccess(spawnResult({
      error: new Error('spawn bun ENOENT'),
      status: null,
    }))).toBe(false);
  });
});
