import type { DocumentCommentSubject } from "@ngriffin_uk/polychat-schemas";

import type { SyncPublisher } from "~/modules/sync/application/publish";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export async function publishDocumentCommentsChanged(
  publisher: SyncPublisher,
  document: { subject: DocumentCommentSubject; projectId?: string | null; createdByUserId: number },
): Promise<void> {
  await publishResourceEvent(
    publisher,
    document.projectId
      ? { kind: "project", projectId: document.projectId }
      : { kind: "personal", userId: document.createdByUserId },
    "document_comments.changed",
    document.subject.type === "output"
      ? { outputId: document.subject.id }
      : { sourceId: document.subject.id },
  );
}
