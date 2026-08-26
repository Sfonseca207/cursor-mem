import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { PlatformAdapter, NormalizedHookInput, HookResult } from '../types.js';
import { AdapterRejectedInput, isValidCwd } from './errors.js';

/**
 * Derive the on-disk path to a Cursor agent transcript JSONL given the
 * workspace cwd and the conversation id. Cursor stores transcripts at:
 *
 *   ~/.cursor/projects/<workspace-slug>/agent-transcripts/<UUID>/<UUID>.jsonl
 *
 * where <workspace-slug> is the absolute cwd with the leading slash stripped
 * and any '/' or '.' replaced with '-' (e.g. /Users/foo.bar/workspaces ->
 * Users-foo-bar-workspaces). Returns undefined if the file does not exist.
 */
// Cursor session ids are UUID-style identifiers. Restrict to a safe character
// set so a malicious sessionId from stdin cannot escape ~/.cursor/projects via
// path separators, '..' segments, or null bytes (security review on PR #2282).
const SAFE_SESSION_ID_RE = /^[A-Za-z0-9_-]+$/;

export function deriveCursorTranscriptPath(cwd: string | undefined, sessionId: string | undefined): string | undefined {
  if (!cwd || !sessionId) return undefined;
  if (!SAFE_SESSION_ID_RE.test(sessionId)) return undefined;
  const slug = cwd.replace(/^\//, '').replace(/[/.]/g, '-');
  const candidate = join(homedir(), '.cursor', 'projects', slug, 'agent-transcripts', sessionId, `${sessionId}.jsonl`);
  return existsSync(candidate) ? candidate : undefined;
}

function parseToolInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export const cursorAdapter: PlatformAdapter = {
  normalizeInput(raw) {
    const r = (raw ?? {}) as any;
    const namedTool = r.tool_name || r.toolName || r.tool;
    const isShellCommand = !!r.command && !namedTool;
    const cwd = r.workspace_roots?.[0] ?? r.cwd ?? process.cwd();
    if (!isValidCwd(cwd)) {
      throw new AdapterRejectedInput('invalid_cwd');
    }
    const sessionId = r.conversation_id || r.generation_id || r.id;
    return {
      sessionId,
      cwd,
      prompt: r.prompt ?? r.query ?? r.input ?? r.message,
      toolName: isShellCommand ? 'Bash' : namedTool,
      toolInput: isShellCommand
        ? { command: r.command }
        : parseToolInput(r.tool_input ?? r.toolInput ?? r.arguments),
      toolResponse: isShellCommand
        ? { output: r.output }
        : (r.result_json ?? r.resultJson ?? r.tool_output ?? r.result ?? r.output),
      // Cursor's stop hook does not pass a transcript path on stdin, but it
      // does write a JSONL transcript to disk under ~/.cursor/projects/...,
      // so we derive the path from cwd + session id.
      transcriptPath: deriveCursorTranscriptPath(cwd, sessionId),
      filePath: r.file_path,
      edits: r.edits,
    };
  },
  formatOutput(result) {
    const output: Record<string, unknown> = {
      continue: result.continue ?? true,
    };
    const hook = result.hookSpecificOutput;
    if (
      hook?.hookEventName === 'SessionStart' &&
      typeof hook.additionalContext === 'string' &&
      hook.additionalContext.length > 0
    ) {
      output.additional_context = hook.additionalContext;
    }
    // Cursor sessionStart accepts user_message (shown in the CLI/IDE). Map the
    // Claude Code systemMessage banner so `agent` prints "started" + viewer URL.
    if (
      hook?.hookEventName === 'SessionStart' &&
      typeof result.systemMessage === 'string' &&
      result.systemMessage.length > 0
    ) {
      output.user_message = result.systemMessage;
    }
    return output;
  }
};
