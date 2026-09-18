function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}

export function isDuplicateMeterEventError(error: unknown): boolean {
  const message = errorMessage(error);

  return /identifier/i.test(message) && /(exist|already|duplicate)/i.test(message);
}

export function isExistingSubscriptionItemError(error: unknown): boolean {
  const message = errorMessage(error);

  return /already/i.test(message) && /(price|plan|item)/i.test(message);
}
