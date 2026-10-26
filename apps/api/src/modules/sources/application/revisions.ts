import {
  listPageOf,
  type ListPage,
  type RestoreSourceRevisionInput,
  type Source,
  type SourceRevision,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { keepsSourceHistory, writeSourceContent } from "~/modules/sources/application/content";
import { getSource, requireSourceAccess } from "~/modules/sources/application/sources";
import {
  SourceRevisionRepository,
  type SourceRevisionRecord,
} from "~/modules/sources/infrastructure/SourceRevisionRepository";

function formatRevision(record: SourceRevisionRecord): SourceRevision {
  return {
    id: record.id,
    revision: record.revision,
    title: record.title,
    content: record.content,
    operation: record.operation,
    restoredFromRevision: record.restored_from_revision,
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
  };
}

export async function listSourceRevisions(
  context: ServiceContext,
  userId: number,
  sourceId: string,
): Promise<ListPage<SourceRevision>> {
  const source = await requireSourceAccess(context, userId, sourceId);
  const records = keepsSourceHistory(source)
    ? await context.repositories.get(SourceRevisionRepository).list(source.id)
    : [];

  return listPageOf(records.map(formatRevision), (revision) => revision.id);
}

export async function restoreSourceRevision(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  input: RestoreSourceRevisionInput,
): Promise<Source> {
  const source = await requireSourceAccess(context, userId, sourceId, true);
  const revision = keepsSourceHistory(source)
    ? await context.repositories.get(SourceRevisionRepository).get(source.id, input.revision)
    : null;

  if (!revision) {
    throw new AssistantError("That version is not kept any more", ErrorType.NOT_FOUND, 404);
  }

  await writeSourceContent(context, source, {
    userId,
    content: revision.content,
    title: revision.title,
    expectedRevision: input.expectedRevision,
    operation: "restored",
    restoredFromRevision: revision.revision,
  });

  return getSource(context, userId, source.id);
}
