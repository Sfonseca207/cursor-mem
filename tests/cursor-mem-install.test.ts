import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DUMP_RULE_NAME,
  HOOK_EVENTS,
  HOOK_SCRIPT_NAME,
  MCP_SERVER_NAME,
  SHORT_RULE_NAME,
  ZSHRC_MARKER,
  agentWrapperPath,
  checkUserCursorMem,
  hookScriptPath,
  installUserCursorMem,
  mcpServerPath,
  shellenvPath,
  stripZshrcSnippet,
  uninstallUserCursorMem,
  workerScriptPath,
  type HooksJson,
  type InstallLayout,
  type McpJson,
} from '../scripts/cursor-mem-install.ts';
import { REPO_ROOT } from '../scripts/cursor-mem-runtime.ts';

function makeLayout(): InstallLayout {
  const root = join(tmpdir(), `cursor-mem-install-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {
    cursorDir: join(root, '.cursor'),
    repoRoot: REPO_ROOT,
    dataDir: join(root, '.cursor-mem'),
    workerPort: '37850',
    zshrcPath: join(root, '.zshrc'),
  };
}

describe('cursor-mem user install', () => {
  let layout: InstallLayout;
  let homeRoot: string;

  beforeEach(() => {
    layout = makeLayout();
    homeRoot = join(layout.cursorDir, '..');
    mkdirSync(homeRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(homeRoot, { recursive: true, force: true });
  });

  it('writes relative Cursor user-hook wrappers for all events, including worker auto-start', () => {
    installUserCursorMem(layout);

    const hooks: HooksJson = JSON.parse(readFileSync(join(layout.cursorDir, 'hooks.json'), 'utf-8'));
    const trampoline = hookScriptPath(REPO_ROOT);
    expect(trampoline.startsWith('/')).toBe(true);

    for (const spec of HOOK_EVENTS) {
      const entries = hooks.hooks[spec.event] ?? [];
      const expected = `./hooks/cursor-mem-${spec.workerEvent}.sh`;
      const ours = entries.find((entry) => entry.command === expected);
      expect(ours).toBeDefined();
      expect(ours?.timeout).toBe(spec.timeout);
      const wrapperPath = join(layout.cursorDir, 'hooks', `cursor-mem-${spec.workerEvent}.sh`);
      expect(existsSync(wrapperPath)).toBe(true);
      expect(readFileSync(wrapperPath, 'utf-8')).toContain(trampoline);
      expect(readFileSync(wrapperPath, 'utf-8')).toContain(spec.workerEvent);
    }
    expect(hooks.hooks.sessionStart.map((e) => e.command)).toEqual([
      './hooks/cursor-mem-ensure-start.sh',
      './hooks/cursor-mem-context.sh',
    ]);
    expect(hooks.hooks.postToolUse[0].command).toBe('./hooks/cursor-mem-observation.sh');
    expect(hooks.hooks.sessionStart[0].timeout).toBe(45);
    expect(hooks.hooks.stop[0].loop_limit).toBe(0);
  });

  it('writes isolated MCP env against this checkout, not marketplace', () => {
    installUserCursorMem(layout);

    const mcp: McpJson = JSON.parse(readFileSync(join(layout.cursorDir, 'mcp.json'), 'utf-8'));
    const server = mcp.mcpServers[MCP_SERVER_NAME];
    expect(server.command).toBe('node');
    expect(server.args).toEqual([mcpServerPath(REPO_ROOT)]);
    expect(server.env?.CLAUDE_MEM_DATA_DIR).toBe(layout.dataDir);
    expect(server.env?.CLAUDE_MEM_WORKER_PORT).toBe('37850');
    expect(server.env?.CLAUDE_MEM_WORKER_SCRIPT_PATH).toBe(workerScriptPath(REPO_ROOT));
    expect(JSON.stringify(server).includes('marketplaces/thedotmack')).toBe(false);
    expect(JSON.stringify(server).includes('${workspaceFolder}')).toBe(false);
  });

  it('merges without clobbering other hooks and MCP servers', () => {
    mkdirSync(layout.cursorDir, { recursive: true });
    writeFileSync(
      join(layout.cursorDir, 'hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeSubmitPrompt: [{ command: 'echo keep-me', timeout: 3 }],
          sessionStart: [
            { command: `bash /old/cursor-mem-hook.sh context`, timeout: 99 },
            { command: 'echo also-keep' },
          ],
        },
      }),
    );
    writeFileSync(
      join(layout.cursorDir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          other: { command: 'python', args: ['/tmp/other.py'] },
        },
      }),
    );

    installUserCursorMem(layout);

    const hooks: HooksJson = JSON.parse(readFileSync(join(layout.cursorDir, 'hooks.json'), 'utf-8'));
    expect(hooks.hooks.beforeSubmitPrompt[0].command).toBe('echo keep-me');
    expect(hooks.hooks.beforeSubmitPrompt[1].command).toBe('./hooks/cursor-mem-session-init.sh');
    expect(hooks.hooks.sessionStart.map((e) => e.command)).toEqual([
      'echo also-keep',
      './hooks/cursor-mem-ensure-start.sh',
      './hooks/cursor-mem-context.sh',
    ]);

    const mcp: McpJson = JSON.parse(readFileSync(join(layout.cursorDir, 'mcp.json'), 'utf-8'));
    expect(mcp.mcpServers.other.command).toBe('python');
    expect(mcp.mcpServers[MCP_SERVER_NAME]).toBeDefined();
  });

  it('does not write claude-mem-context.mdc and leaves a pre-existing dump alone', () => {
    const dumpPath = join(layout.cursorDir, 'rules', DUMP_RULE_NAME);
    mkdirSync(join(layout.cursorDir, 'rules'), { recursive: true });
    writeFileSync(dumpPath, 'alwaysApply dump from product\n');

    installUserCursorMem(layout);

    expect(existsSync(join(layout.cursorDir, 'rules', SHORT_RULE_NAME))).toBe(true);
    expect(readFileSync(join(layout.cursorDir, 'rules', SHORT_RULE_NAME), 'utf-8')).toContain(
      'Do not dump past sessions',
    );
    expect(readFileSync(dumpPath, 'utf-8')).toBe('alwaysApply dump from product\n');
    expect(readFileSync(join(layout.cursorDir, 'rules', SHORT_RULE_NAME), 'utf-8')).not.toContain(
      'Memory Context from Past Sessions',
    );
  });

  it('uninstall removes only our entries and keeps the dump rule', () => {
    mkdirSync(layout.cursorDir, { recursive: true });
    writeFileSync(
      join(layout.cursorDir, 'hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeSubmitPrompt: [{ command: 'echo keep-me' }],
        },
      }),
    );
    writeFileSync(
      join(layout.cursorDir, 'mcp.json'),
      JSON.stringify({
        mcpServers: { other: { command: 'python' } },
      }),
    );
    mkdirSync(join(layout.cursorDir, 'rules'), { recursive: true });
    writeFileSync(join(layout.cursorDir, 'rules', DUMP_RULE_NAME), 'leave me\n');

    installUserCursorMem(layout);
    const result = uninstallUserCursorMem(layout);

    const hooks: HooksJson = JSON.parse(readFileSync(join(layout.cursorDir, 'hooks.json'), 'utf-8'));
    expect(hooks.hooks.beforeSubmitPrompt).toEqual([{ command: 'echo keep-me' }]);
    expect(JSON.stringify(hooks).includes(HOOK_SCRIPT_NAME)).toBe(false);

    const mcp: McpJson = JSON.parse(readFileSync(join(layout.cursorDir, 'mcp.json'), 'utf-8'));
    expect(mcp.mcpServers.other.command).toBe('python');
    expect(mcp.mcpServers[MCP_SERVER_NAME]).toBeUndefined();

    expect(existsSync(join(layout.cursorDir, 'rules', SHORT_RULE_NAME))).toBe(false);
    expect(readFileSync(join(layout.cursorDir, 'rules', DUMP_RULE_NAME), 'utf-8')).toBe('leave me\n');
    expect(result.leftDumpUntouched).toBe(true);
    expect(result.removedRule).toBe(true);
  });

  it('uninstall deletes hooks.json and mcp.json when they only contained us', () => {
    installUserCursorMem(layout);
    uninstallUserCursorMem(layout);
    expect(existsSync(join(layout.cursorDir, 'hooks.json'))).toBe(false);
    expect(existsSync(join(layout.cursorDir, 'mcp.json'))).toBe(false);
  });

  it('checkUserCursorMem passes after install', () => {
    installUserCursorMem(layout);
    const check = checkUserCursorMem(layout);
    expect(check.ok).toBe(true);
    expect(check.errors).toEqual([]);
  });

  it('checkUserCursorMem fails when MCP points at marketplace', () => {
    installUserCursorMem(layout);
    const mcpPath = join(layout.cursorDir, 'mcp.json');
    const mcp: McpJson = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    mcp.mcpServers[MCP_SERVER_NAME].args = [
      '/Users/x/.claude/plugins/marketplaces/thedotmack/plugin/scripts/mcp-server.cjs',
    ];
    writeFileSync(mcpPath, JSON.stringify(mcp, null, 2));

    const check = checkUserCursorMem(layout);
    expect(check.ok).toBe(false);
    expect(check.errors.some((e) => e.includes('marketplace') || e.includes('mcp-server.cjs'))).toBe(true);
  });

  it('writes an agent wrapper and a zshrc snippet so agent prints the viewer URL', () => {
    writeFileSync(layout.zshrcPath!, 'export EDITOR=vim\n');
    installUserCursorMem(layout);

    const wrapper = readFileSync(agentWrapperPath(layout), 'utf-8');
    expect(wrapper).toContain('#!/usr/bin/env bash');
    expect(wrapper).toContain('preflight');
    expect(wrapper).toContain('exec "$REAL"');
    expect(readFileSync(shellenvPath(layout), 'utf-8')).toContain(`${layout.dataDir}/bin`);

    const zshrc = readFileSync(layout.zshrcPath!, 'utf-8');
    expect(zshrc).toContain('export EDITOR=vim');
    expect(zshrc).toContain(ZSHRC_MARKER);
    installUserCursorMem(layout);
    expect(readFileSync(layout.zshrcPath!, 'utf-8').split(ZSHRC_MARKER).length).toBe(2);
  });

  it('uninstall strips the zshrc snippet and agent wrapper', () => {
    writeFileSync(layout.zshrcPath!, 'export EDITOR=vim\n');
    installUserCursorMem(layout);
    uninstallUserCursorMem(layout);

    expect(existsSync(agentWrapperPath(layout))).toBe(false);
    const zshrc = readFileSync(layout.zshrcPath!, 'utf-8');
    expect(zshrc).toContain('export EDITOR=vim');
    expect(zshrc).not.toContain(ZSHRC_MARKER);
    expect(stripZshrcSnippet(`${ZSHRC_MARKER}\n[ -f x/shellenv.sh ] && . x/shellenv.sh\nkeep\n`)).toContain('keep');
  });
});
