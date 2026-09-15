import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getActiveThreadOperation } from "~/services/conversations/coordinator/client";
import { publishConversationChanged, publishRunChanged } from "~/services/sync/conversation-events";
import { withoutOrigin } from "~/services/sync/publish";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/chat-runs/recovery" });

async function announceRecoveredRun(context: ServiceContext, run: ChatRun): Promise<void> {
  try {
    const publisher = withoutOrigin(context);

    await publishRunChanged(publisher, run);
    await publishConversationChanged(publisher, run.conversationId, { runId: run.id });
  } catch (error) {
    logger.error("Could not publish recovered chat run state", { error, runId: run.id });
  }
}

export async function reconcileInactiveChatRun(
  context: ServiceContext,
  run: ChatRun,
): Promise<ChatRun> {
  if (run.status !== "accepted" && run.status !== "running" && run.status !== "cancelling") {
    return run;
  }

  let activeOperation: Awaited<ReturnType<typeof getActiveThreadOperation>>;

  try {
    activeOperation = await getActiveThreadOperation({
      env: context.env,
      conversationId: run.conversationId,
    });
  } catch (error) {
    logger.error("Could not confirm chat run execution ownership", { error, runId: run.id });

    return run;
  }

  if (activeOperation !== null) {
    return run;
  }

  const cancelled = run.status === "cancelling";
  const transitioned = await context.repositories.conversationRuns.transition({
    runId: run.id,
    attempt: run.attempt,
    status: cancelled ? "cancelled" : "interrupted",
    terminalReason: cancelled
      ? "Execution ownership ended after cancellation was requested."
      : "Execution ownership ended before the run completed.",
  });

  if (transitioned) {
    await announceRecoveredRun(context, transitioned);

    return transitioned;
  }

  return (await context.repositories.conversationRuns.getById(run.id)) ?? run;
}
