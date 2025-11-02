export type RetryableErrorPredicate = (error: unknown) => boolean;

/**
 * Retries a function up to retryCount times with exponential backoff and jitter.
 *
 * @param fn The function to retry
 * @param options Configuration options for retry behavior
 * @returns The result of the function execution
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: {
		retryCount?: number;
		baseDelayMs?: number;
		isRetryableError?: RetryableErrorPredicate;
		onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
	} = {},
): Promise<T> {
	const {
		retryCount = 2,
		baseDelayMs = 500,
		isRetryableError = () => true,
		onRetry = () => {},
	} = options;

	let lastError: unknown;

	for (let attempt = 0; attempt <= retryCount; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;

			if (!isRetryableError(err)) {
				throw err;
			}

			if (attempt < retryCount) {
				const baseDelay = baseDelayMs * 2 ** attempt;

				const jitter = baseDelay * (0.7 + Math.random() * 0.6);
				const delayMs = Math.floor(jitter);

				onRetry(attempt + 1, err, delayMs);

				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	throw lastError;
}
