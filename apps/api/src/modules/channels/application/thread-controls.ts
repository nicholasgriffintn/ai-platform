import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { isTerminalChatRunStatus, channelRunAuthoritySchema } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { cleanupCancelledChatRun } from "~/modules/chat-runs/application/cancellation-cleanup";
import { cancelDelegationTree } from "~/modules/delegations/application/cancel-tree";

export async function cancelChannelThreadRun(params: {
  context: ServiceContext;
  conversationId: string;
  userId: number;
  revision: number;
}): Promise<void> {
  const run = await params.context.repositories.conversationRuns.getLatestForConversation(
    params.conversationId,
  );

  const authority = channelRunAuthoritySchema.safeParse(
    run?.resolvedConfiguration?.channelDelivery,
  );

  if (
    !authority.success ||
    authority.data.thread.revision >= params.revision ||
    !run ||
    isTerminalChatRunStatus(run.status) ||
    !ownsResource(params.userId, run.initiatorUserId)
  ) {
    return;
  }

  await params.context.repositories.conversationRuns.acceptCancellation({
    commandId: `channel_stop_${run.id}_${run.attempt}_${params.revision}`,
    digest: await sha256Hex(canonicalJson({ runId: run.id, expectedAttempt: run.attempt })),
    expectedAttempt: run.attempt,
    runId: run.id,
    userId: params.userId,
  });
  await cleanupCancelledChatRun(params.context, run);
  await cancelDelegationTree(params.context, run.id);
}
