const SAFETY_MARGIN_MS = 2 * 60 * 1000;

export function isTokenStale(expiryMs: number, nowMs: number): boolean {
  return expiryMs - nowMs <= SAFETY_MARGIN_MS;
}

export function expiresAtMs(expiresInSeconds: number, nowMs: number): number {
  return nowMs + Math.max(0, expiresInSeconds) * 1000;
}
