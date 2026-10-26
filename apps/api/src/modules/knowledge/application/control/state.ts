import type { KnowledgeDocumentState } from "@ngriffin_uk/polychat-schemas";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { KNOWLEDGE_ENRICHERS } from "~/modules/knowledge/application/enrichment/registry";
import {
  readKnowledgeBody,
  readKnowledgeEnrichments,
  readKnowledgeExpiry,
  readKnowledgeOrigin,
  readKnowledgeRetrieval,
  readKnowledgeUpstream,
  storedCharacters,
} from "~/modules/knowledge/domain/envelope";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { KnowledgeIndexRepository } from "~/modules/knowledge/infrastructure/KnowledgeIndexRepository";
import { KnowledgeLinkRepository } from "~/modules/knowledge/infrastructure/KnowledgeLinkRepository";
import { requireSourceAccess } from "~/modules/sources/application/sources";

export async function getKnowledgeDocumentState(
  context: ServiceContext,
  sourceId: string,
): Promise<KnowledgeDocumentState> {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId);
  const metadata = parseJsonRecord(source.metadata);
  const states = readKnowledgeEnrichments(metadata);
  const links = context.repositories.get(KnowledgeLinkRepository);
  const [document, collections, relations, sensitivity] = await Promise.all([
    context.repositories.get(KnowledgeIndexRepository).latestDocument("source", source.id),
    links.listSourceCollections(source.id),
    links.listRelations(source.id),
    context.repositories.get(KnowledgeDocumentRepository).getSensitivity(source.id),
  ]);

  return {
    sourceId: source.id,
    origin: readKnowledgeOrigin(metadata),
    upstream: readKnowledgeUpstream(metadata),
    retrieval: readKnowledgeRetrieval(metadata),
    expiresAt: readKnowledgeExpiry(metadata),
    sensitivity: sensitivity?.sensitivity ?? null,
    stored: readKnowledgeBody(metadata) ? "body" : "inline",
    characters: storedCharacters(source.content, metadata),
    indexed: document && document.status !== "stale" ? document.status : "pending",
    enrichments: KNOWLEDGE_ENRICHERS.filter((enricher) => enricher.appliesTo(source)).map(
      (enricher) => {
        const state = states[enricher.name];

        return {
          name: enricher.name,
          label: enricher.label,
          status: state?.status ?? "pending",
          at: state?.at ?? null,
          error: state?.error ?? null,
        };
      },
    ),
    collections,
    relations,
  };
}
