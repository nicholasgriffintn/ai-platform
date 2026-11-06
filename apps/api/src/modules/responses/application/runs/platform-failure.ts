import { reconcileRunCharge } from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

const logger = getLogger({ prefix: "services/chat-runs/platform-failure" });

const PLATFORM_ERROR_TYPES: ReadonlySet<ErrorType> = new Set([
  ErrorType.CONFIGURATION_ERROR,
  ErrorType.DATABASE_ERROR,
  ErrorType.EXTERNAL_API_ERROR,
  ErrorType.INTERNAL_ERROR,
  ErrorType.NETWORK_ERROR,
  ErrorType.PROVIDER_ERROR,
  ErrorType.RATE_LIMIT_ERROR,
  ErrorType.STORAGE_ERROR,
  ErrorType.UNKNOWN_ERROR,
]);

const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 429]);

function isCallerStatus(statusCode: number | undefined): boolean {
  return (
    statusCode !== undefined &&
    statusCode >= 400 &&
    statusCode < 500 &&
    !RETRYABLE_CLIENT_STATUSES.has(statusCode)
  );
}

export function isPlatformFailure(error: unknown): boolean {
  if (!(error instanceof AssistantError)) {
    return true;
  }

  return PLATFORM_ERROR_TYPES.has(error.type) && !isCallerStatus(error.statusCode);
}

export async function refundPlatformFailedRun(
  context: Pick<ServiceContext, "env" | "repositories">,
  run: Pick<ChatRun, "id">,
): Promise<void> {
  try {
    await context.repositories.get(ConversationRunRepository).markUsageRefunded(run.id);
    await reconcileRunCharge(
      createUsageRuntime({ env: context.env, repositories: context.repositories }),
      run.id,
    );
  } catch (error) {
    logger.error("Failed to refund a platform-failed run", { error, runId: run.id });
  }
}
