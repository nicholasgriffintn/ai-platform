import {
  resolveUsageBalanceResponse,
  userCreditActor,
  type UsageStore,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import type { SyncPublisher } from "~/modules/sync/application/publish";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export async function publishUsageChanged(
  publisher: SyncPublisher,
  store: UsageStore,
  userId: number,
  period: string,
): Promise<void> {
  if (!publisher.env?.USER_SYNC_COORDINATOR) {
    return;
  }

  try {
    const balance = await resolveUsageBalanceResponse(store, userCreditActor(userId), period);

    await publishResourceEvent(publisher, { kind: "personal", userId }, "usage.changed", balance);
  } catch (error) {
    getLogger({ prefix: "usage/events" }).error("Usage notification failed", { error, userId });
  }
}
