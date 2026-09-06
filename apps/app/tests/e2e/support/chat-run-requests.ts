export function isChatRunRecoveryRequest(url: string): boolean {
  return /\/chat\/runs\/[^/]+\/(?:events|snapshot)$/.test(new URL(url).pathname);
}
