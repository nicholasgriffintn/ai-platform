import {
  isTerminalChatRunStatus,
  teammateRunConfigurationSchema,
  type Delegation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { cleanupCancelledChatRun } from "~/services/chat-runs/cancellation-cleanup";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";

export async function cancelDelegationChildRun(
  context: ServiceContext,
  delegation: Pick<Delegation, "id" | "childConversationId">,
  userId: number,
  reason: string,
): Promise<void> {
  const run = await context.repositories.conversationRuns.getLatestForConversation(
    delegation.childConversationId,
  );
  const configuration = run
    ? teammateRunConfigurationSchema.safeParse(run.resolvedConfiguration)
    : null;

  if (
    !run ||
    isTerminalChatRunStatus(run.status) ||
    !configuration?.success ||
    configuration.data.invocation?.source !== "delegation" ||
    configuration.data.invocation.delegationId !== delegation.id
  ) {
    return;
  }

  const commandId = `delegation_cancel_${delegation.id}_${run.attempt}`;
  const receipt = await context.repositories.conversationRuns.acceptCancellation({
    commandId,
    digest: await sha256Hex(
      canonicalJson({ runId: run.id, expectedAttempt: run.attempt, delegationId: delegation.id }),
    ),
    expectedAttempt: run.attempt,
    runId: run.id,
    userId,
  });

  await cleanupCancelledChatRun(context, run);

  if (!isTerminalChatRunStatus(receipt.run.status)) {
    await context.repositories.conversationRuns.transition({
      runId: run.id,
      attempt: run.attempt,
      status: "cancelled",
      terminalReason: reason,
    });
  }
}
