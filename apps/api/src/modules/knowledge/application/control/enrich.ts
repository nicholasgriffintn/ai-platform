import type { EnrichSourceInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findKnowledgeEnricher } from "~/modules/knowledge/application/enrichment/registry";
import { runKnowledgeEnricher } from "~/modules/knowledge/application/enrichment/run";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { getSource, requireSourceAccess } from "~/modules/sources/application/sources";

export async function enrichKnowledgeDocument(
  context: ServiceContext,
  sourceId: string,
  input: EnrichSourceInput,
) {
  const userId = context.requireUser().id;
  const enricher = findKnowledgeEnricher(input.enricher);

  if (!enricher || enricher.trigger !== "request") {
    throw new AssistantError("This file can't be read that way", ErrorType.PARAMS_ERROR, 400);
  }

  if (input.readAs) {
    if (enricher.name !== "reading") {
      throw new AssistantError("Only a reading takes a form", ErrorType.PARAMS_ERROR, 400);
    }

    await setReadAs(context, sourceId, input.readAs);
  }

  await runKnowledgeEnricher(context, sourceId, enricher.name);

  return getSource(context, userId, sourceId);
}

async function setReadAs(
  context: ServiceContext,
  sourceId: string,
  readAs: NonNullable<EnrichSourceInput["readAs"]>,
): Promise<void> {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId, true);

  await context.repositories.get(KnowledgeDocumentRepository).setReadAs([source.id], readAs);
}
