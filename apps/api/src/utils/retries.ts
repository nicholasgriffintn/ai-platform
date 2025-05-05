/**
 * Retries a function up to retryCount times with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retryCount = 2,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retryCount) {
        const delayMs = baseDelayMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
