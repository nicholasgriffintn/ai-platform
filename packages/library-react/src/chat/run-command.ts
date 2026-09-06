import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { withRetry } from "@ngriffin_uk/polychat-library-client/retry";
import type { ChatRun, ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";

export async function resolveAcceptedRunCommand(params: {
  fetchCommand: () => Promise<ChatRunCommandReceipt>;
  attempts?: number;
  intervalMs?: number;
}): Promise<ChatRun | null> {
  const attempts = params.attempts ?? 10;
  const intervalMs = params.intervalMs ?? 250;

  try {
    return await withRetry(() => params.fetchCommand().then((receipt) => receipt.run), {
      maxAttempts: attempts,
      baseDelayMs: intervalMs,
      maxDelayMs: intervalMs,
      jitterMs: 0,
      isRetryable: (error) => error instanceof ApiError && error.status === 404,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}
