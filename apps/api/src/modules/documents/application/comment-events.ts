import type { SyncPublisher } from "~/modules/sync/application/publish";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export async function publishDocumentCommentsChanged(
  publisher: SyncPublisher,
  output: { id: string; projectId?: string | null; createdByUserId: number },
): Promise<void> {
  await publishResourceEvent(
    publisher,
    output.projectId
      ? { kind: "project", projectId: output.projectId }
      : { kind: "personal", userId: output.createdByUserId },
    "document_comments.changed",
    { outputId: output.id },
  );
}
