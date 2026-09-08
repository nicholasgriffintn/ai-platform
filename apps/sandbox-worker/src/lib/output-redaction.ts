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

export function redactSandboxResult<T extends { stdout: string; stderr: string }>(
  result: T,
  secrets: readonly string[] = [],
): T {
  return {
    ...result,
    stdout: redactSandboxOutput(result.stdout, secrets),
    stderr: redactSandboxOutput(result.stderr, secrets),
  };
}

export function createSandboxOutputRedactor(secrets: readonly string[] = []) {
  const values = secrets.filter((secret) => secret.length > 0);
  const lookahead = Math.max(1, ...values.map((secret) => secret.length));
  let pending = "";
  let omitted = false;

  return {
    push(value: string): string {
      if (omitted) {
        return "";
      }

      pending += value;
      if (pending.length > 1_000_000) {
        pending = "";
        omitted = true;

        return "[oversized output omitted]\n";
      }

      if (pending.length < lookahead) {
        return "";
      }

      let boundary = pending.lastIndexOf("\n", pending.length - lookahead) + 1;

      let previousBoundary: number;

      do {
        previousBoundary = boundary;
        for (const secret of values) {
          const start = pending.indexOf(secret, Math.max(0, boundary - secret.length + 1));

          if (start >= 0 && start < boundary && start + secret.length > boundary) {
            boundary = start;
          }
        }

        const incompleteCredential = pending
          .slice(0, boundary)
          .match(
            /\b(?:Bearer\s*|(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|secret)\s*[:=]\s*)$/i,
          );

        if (incompleteCredential) {
          boundary -= incompleteCredential[0].length;
        }
      } while (boundary !== previousBoundary);

      const output = redactSandboxOutput(pending.slice(0, boundary), values);

      pending = pending.slice(boundary);

      return output;
    },
    flush(): string {
      let value = redactSandboxOutput(pending, values);

      pending = "";
      for (const secret of values) {
        for (let length = Math.min(secret.length - 1, value.length); length > 0; length -= 1) {
          if (value.endsWith(secret.slice(0, length))) {
            value = `${value.slice(0, -length)}[redacted credential]`;
            break;
          }
        }
      }

      return value;
    },
  };
}
