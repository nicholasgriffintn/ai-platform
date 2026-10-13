import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import type { SyncPublisher } from "~/modules/sync/application/publish";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export async function publishChannelSendersChanged(
  publisher: SyncPublisher,
  binding: Pick<ChannelBindingRow, "id" | "scope_type" | "scope_id">,
): Promise<void> {
  await publishResourceEvent(
    publisher,
    binding.scope_type === "project"
      ? { kind: "project", projectId: binding.scope_id }
      : { kind: "personal", userId: Number(binding.scope_id) },
    "channel_senders.changed",
    { bindingId: binding.id },
  );
}
