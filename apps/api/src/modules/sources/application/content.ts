import type { SourceStatus } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { reviseKnowledgeContent } from "~/modules/knowledge/application/intake/revise";
import { publishSourceChanged } from "~/modules/sources/application/media/metadata";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import {
  SourceRevisionRepository,
  type SourceRevisionOperation,
} from "~/modules/sources/infrastructure/SourceRevisionRepository";

export interface SourceContentWrite {
  userId: number;
  content: string;
  title?: string;
  status?: SourceStatus;
  metadata?: Record<string, unknown>;
  expectedRevision?: number;
  editSession?: string;
  operation: Exclude<SourceRevisionOperation, "created">;
  restoredFromRevision?: number;
}

function changedElsewhere(): AssistantError {
  return new AssistantError(
    "This file changed somewhere else. Reload it to see the latest version.",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

export function keepsSourceHistory(source: Pick<SourceRecord, "kind">): boolean {
  return source.kind === "text";
}

export async function writeSourceContent(
  context: ServiceContext,
  existing: SourceRecord,
  write: SourceContentWrite,
): Promise<void> {
  if (write.expectedRevision !== undefined && write.expectedRevision !== existing.revision) {
    throw changedElsewhere();
  }

  const revisions = context.repositories.get(SourceRevisionRepository);
  const keepsHistory = keepsSourceHistory(existing);

  if (keepsHistory) {
    await revisions.recordBaseline(
      existing.id,
      existing.revision,
      {
        title: existing.title,
        content: await readKnowledgeText(context, existing),
        userId: existing.created_by_user_id,
      },
      existing.created_at,
    );
  }

  const advanced = await revisions.advance({
    sourceId: existing.id,
    expectedRevision: existing.revision,
    snapshot: keepsHistory
      ? { title: write.title ?? existing.title, content: write.content, userId: write.userId }
      : null,
    operation: write.operation,
    editSession: write.editSession,
    restoredFromRevision: write.restoredFromRevision,
  });

  if (advanced === null) {
    throw changedElsewhere();
  }

  await reviseKnowledgeContent(context, existing, {
    content: write.content,
    ...(write.title ? { title: write.title } : {}),
    ...(write.status ? { status: write.status } : {}),
    ...(write.metadata ? { metadata: write.metadata } : {}),
  });
  await publishSourceChanged(context, existing);
}
