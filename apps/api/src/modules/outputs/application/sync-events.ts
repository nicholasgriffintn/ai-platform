import type { SyncPublisher } from "~/modules/sync/application/publish";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

import type { OutputRecord } from "../infrastructure/OutputRepository";

export async function publishOutputChanged(
  publisher: SyncPublisher,
  output: Pick<OutputRecord, "id" | "project_id" | "created_by_user_id">,
): Promise<void> {
  await publishResourceEvent(
    publisher,
    output.project_id
      ? { kind: "project", projectId: output.project_id }
      : { kind: "personal", userId: output.created_by_user_id },
    "output.changed",
    { outputId: output.id },
  );
}
