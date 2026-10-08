import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { THREAD_LEASE_DURATION_MS } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import { reconcileInactiveChatRun } from "./recovery";

const logger = getLogger({ prefix: "services/chat-runs/interrupted-run-sweep" });

const SWEEP_BATCH_SIZE = 50;

export async function sweepInterruptedChatRuns(env: IEnv, now = new Date()): Promise<number> {
  const context = createServiceContext({ env });
  const updatedBefore = new Date(now.getTime() - THREAD_LEASE_DURATION_MS).toISOString();
  const candidates = await context.repositories.conversationRuns.listActiveRunsUpdatedBefore(
    updatedBefore,
    SWEEP_BATCH_SIZE,
  );
  let settled = 0;

  for (const run of candidates) {
    try {
      const reconciled = await reconcileInactiveChatRun(context, run);

      if (reconciled.status !== run.status) {
        settled += 1;
      }
    } catch (error) {
      logger.warn("Could not reconcile an inactive chat run", {
        runId: run.id,
        error: getErrorMessage(error),
      });
    }
  }

  return settled;
}
