const SAFETY_MARGIN_MS = 2 * 60 * 1000;
const MINIMUM_DELAY_MS = 30 * 1000;
const MAXIMUM_DELAY_MS = 30 * 60 * 1000;

export function refreshDelayMs(expiresInSeconds: number): number {
  const lifetime = Math.max(0, expiresInSeconds) * 1000;

  return Math.min(MAXIMUM_DELAY_MS, Math.max(MINIMUM_DELAY_MS, lifetime - SAFETY_MARGIN_MS));
}

export function isTokenStale(expiryMs: number, nowMs: number): boolean {
  return expiryMs - nowMs <= SAFETY_MARGIN_MS;
}

export function expiresAtMs(expiresInSeconds: number, nowMs: number): number {
  return nowMs + Math.max(0, expiresInSeconds) * 1000;
}
