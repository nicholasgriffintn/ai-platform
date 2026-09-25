export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export function assertUnreachable(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
