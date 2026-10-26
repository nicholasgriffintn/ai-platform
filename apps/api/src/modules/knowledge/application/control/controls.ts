import type { KnowledgeDocumentControls } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getKnowledgeDocumentState } from "~/modules/knowledge/application/control/state";
import { publishKnowledgeChange } from "~/modules/knowledge/application/events";
import { enqueueKnowledgeProcessing } from "~/modules/knowledge/application/index/indexing";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { requireSourceAccess } from "~/modules/sources/application/sources";

export async function setKnowledgeDocumentControls(
  context: ServiceContext,
  sourceId: string,
  controls: KnowledgeDocumentControls,
) {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId, true);

  if (source.kind === "memory" || parseJsonRecord(source.metadata).immutableSnapshot === true) {
    throw new AssistantError(
      "This document's controls are managed elsewhere",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.get(KnowledgeDocumentRepository).setControls(source.id, controls);
  await publishKnowledgeChange(context, source, "updated", { controls: Object.keys(controls) });

  return getKnowledgeDocumentState(context, source.id);
}

export async function reprocessKnowledgeDocument(context: ServiceContext, sourceId: string) {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId, true);

  await enqueueKnowledgeProcessing(context.env, source, context.requireUser().id);

  return getKnowledgeDocumentState(context, source.id);
}
