import { describe, it, expect } from 'bun:test';
import { cursorMemSessionBanner, cursorMemViewerUrl, formatPreflightBanner } from '../src/cli/cursor-mem-banner.ts';

describe('cursor-mem session banner', () => {
  it('points at the isolated worker viewer', () => {
    expect(cursorMemViewerUrl(37850)).toBe('http://localhost:37850');
    expect(cursorMemSessionBanner(37850)).toBe(
      'cursor-mem started\nView memories @ http://localhost:37850',
    );
    expect(formatPreflightBanner(true, 37850)).toContain('http://localhost:37850');
    expect(formatPreflightBanner(false, 37850)).toContain('did not become ready');
  });
});
