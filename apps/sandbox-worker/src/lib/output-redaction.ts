export function redactSandboxOutput(value: string, secrets: readonly string[] = []): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .sort((left, right) => right.length - left.length)
    .reduce((redacted, secret) => redacted.replaceAll(secret, "[redacted credential]"), value)
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|gh[pousr])_[A-Za-z0-9_-]{12,}\b/g, "[redacted credential]")
    .replace(
      /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|secret)\s*[:=]\s*)(["']?)[^\s,"']+\2/gi,
      "$1[redacted]",
    )
    .replace(/:\/\/([^/@:\s]+):([^/@\s]+)@/g, "://[redacted]@");
}
