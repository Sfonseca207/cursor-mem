import { describe, it, expect, beforeEach, afterEach, afterAll, spyOn, mock } from 'bun:test';
import { homedir } from 'os';
import { join } from 'path';

import * as realSettingsDefaultsManager from '../../../src/shared/SettingsDefaultsManager.js';
import * as realHookSettings from '../../../src/shared/hook-settings.js';
import * as realWorkerUtils from '../../../src/shared/worker-utils.js';
const realSettingsSnapshot = { ...realSettingsDefaultsManager };
const realHookSettingsSnapshot = { ...realHookSettings };
const realWorkerUtilsSnapshot = { ...realWorkerUtils };

mock.module('../../../src/shared/SettingsDefaultsManager.js', () => ({
  SettingsDefaultsManager: {
    get: (key: string) => {
      if (key === 'CLAUDE_MEM_DATA_DIR') return join(homedir(), '.claude-mem');
      return '';
    },
    getInt: () => 0,
    loadFromFile: () => ({ CLAUDE_MEM_EXCLUDED_PROJECTS: '' }),
  },
}));

mock.module('../../../src/shared/hook-settings.js', () => ({
  loadFromFileOnce: () => ({ CLAUDE_MEM_EXCLUDED_PROJECTS: '' }),
}));

const workerCallLog: Array<{ path: string; method: string; body: any }> = [];
mock.module('../../../src/shared/worker-utils.js', () => ({
  ensureWorkerRunning: () => Promise.resolve(true),
  getWorkerPort: () => 37777,
  workerHttpRequest: (apiPath: string, options?: any) => {
    workerCallLog.push({ path: apiPath, method: options?.method ?? 'GET', body: options?.body });
    return Promise.resolve(new Response('{"status":"queued"}', { status: 200 }));
  },
  executeWithWorkerFallback: async (apiPath: string, method: string, body: unknown) => {
    workerCallLog.push({ path: apiPath, method, body });
    return { status: 'queued' };
  },
  isWorkerFallback: (_result: unknown) => false,
}));

import { logger } from '../../../src/utils/logger.js';

let loggerSpies: ReturnType<typeof spyOn>[] = [];

beforeEach(() => {
  workerCallLog.length = 0;
  loggerSpies = [
    spyOn(logger, 'info').mockImplementation(() => {}),
    spyOn(logger, 'debug').mockImplementation(() => {}),
    spyOn(logger, 'warn').mockImplementation(() => {}),
    spyOn(logger, 'error').mockImplementation(() => {}),
    spyOn(logger, 'failure').mockImplementation(() => {}),
    spyOn(logger, 'dataIn').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  loggerSpies.forEach(spy => spy.mockRestore());
});

afterAll(() => {
  mock.module('../../../src/shared/SettingsDefaultsManager.js', () => realSettingsSnapshot);
  mock.module('../../../src/shared/hook-settings.js', () => realHookSettingsSnapshot);
  mock.module('../../../src/shared/worker-utils.js', () => realWorkerUtilsSnapshot);
});

describe('summarizeHandler — Cursor observations-only', () => {
  it('POSTs summarize for cursor with no transcript', async () => {
    const { summarizeHandler } = await import('../../../src/cli/handlers/summarize.js');

    const result = await summarizeHandler.execute({
      sessionId: 'cursor-session',
      cwd: '/tmp',
      platform: 'cursor',
    });

    expect(result.continue).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(workerCallLog).toHaveLength(1);
    expect(workerCallLog[0].path).toBe('/api/sessions/summarize');
    expect(workerCallLog[0].body).toMatchObject({
      contentSessionId: 'cursor-session',
      last_assistant_message: '',
      platformSource: 'cursor',
    });
  });

  it('skips Claude Code with no transcript', async () => {
    const { summarizeHandler } = await import('../../../src/cli/handlers/summarize.js');

    const result = await summarizeHandler.execute({
      sessionId: 'claude-session',
      cwd: '/tmp',
      platform: 'claude-code',
    });

    expect(result.continue).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(workerCallLog).toHaveLength(0);
  });
});
