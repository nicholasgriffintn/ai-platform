import type {
  ChatRunCommandReceiptResponse,
  CancelChatRunRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";

import { recordChatRunOperationalMetric } from "./operational-metrics";
import { requireChatRunAccess } from "./status";

export async function handleCancelChatRun(
  context: ServiceContext,
  runId: string,
  request: CancelChatRunRequest,
): Promise<ChatRunCommandReceiptResponse> {
  const user = context.requireUser();
  const run = await requireChatRunAccess(context, runId);

  if (run.initiatorUserId !== user.id) {
    throw new AssistantError(
      "Only the run initiator can cancel this run",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (run.attempt !== request.expected_attempt) {
    throw new AssistantError(
      "The run attempt changed before cancellation was accepted",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const receipt = await context.repositories.conversationRuns.acceptCancellation({
    commandId: request.command_id,
    digest: await sha256Hex(
      canonicalJson({ runId: run.id, expectedAttempt: request.expected_attempt }),
    ),
    expectedAttempt: request.expected_attempt,
    runId: run.id,
    userId: user.id,
  });

  if (receipt.duplicate) {
    recordChatRunOperationalMetric(context.env, {
      signal: "duplicate_command",
      runId: receipt.run.id,
      attempt: receipt.run.attempt,
      commandKind: "cancel",
      outcome: "success",
    });
  } else if (receipt.run.status === "cancelled" && receipt.run.cancellationRequestedAt) {
    recordChatRunOperationalMetric(context.env, {
      signal: "cancellation_latency",
      runId: receipt.run.id,
      attempt: receipt.run.attempt,
      outcome: "success",
      value: Math.max(
        0,
        Date.parse(receipt.run.updatedAt) - Date.parse(receipt.run.cancellationRequestedAt),
      ),
    });
  }

  return { run: receipt };
}
