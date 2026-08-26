export function cursorMemViewerUrl(port: number): string {
  return `http://localhost:${port}`;
}

export function cursorMemSessionBanner(port: number): string {
  return `cursor-mem started\nView memories @ ${cursorMemViewerUrl(port)}`;
}

export function formatPreflightBanner(ok: boolean, port: number): string {
  const body = cursorMemSessionBanner(port);
  if (ok) return `\n${body}\n`;
  return `\n${body}\n(worker did not become ready; memory is best-effort)\n`;
}
