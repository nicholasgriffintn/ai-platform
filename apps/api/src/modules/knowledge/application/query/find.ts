import type { GlobalSearchDocument } from "@ngriffin_uk/polychat-schemas";
import { toFtsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import type { Repositories } from "~/infrastructure/database/repositories";
import {
  KnowledgeIndexRepository,
  type KnowledgePassage,
} from "~/modules/knowledge/infrastructure/KnowledgeIndexRepository";

export type KnowledgeMention = Pick<
  KnowledgePassage,
  "sourceId" | "resourceType" | "title" | "content" | "updatedAt"
>;

const SNIPPET_CHARACTERS = 160;

export async function findKnowledgeDocuments(
  repositories: Repositories,
  userId: number,
  query: string,
  limit: number,
): Promise<GlobalSearchDocument[]> {
  const fts = toFtsQuery(query);

  if (!fts) {
    return [];
  }

  const passages = await repositories
    .get(KnowledgeIndexRepository)
    .lexical({ userId, filters: { resourceTypes: ["source"] } }, fts);
  const documents = new Map<string, GlobalSearchDocument>();

  for (const passage of passages) {
    if (documents.size >= limit) {
      break;
    }

    if (!documents.has(passage.sourceId)) {
      documents.set(passage.sourceId, {
        id: passage.sourceId,
        title: passage.title,
        kind: passage.type,
        snippet: passage.content.replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARACTERS),
        updatedAt: passage.updatedAt,
      });
    }
  }

  return [...documents.values()];
}

export async function findPersonalKnowledgeMentions(
  repositories: Repositories,
  userId: number,
  ftsQuery: string,
): Promise<KnowledgeMention[]> {
  const passages = await repositories
    .get(KnowledgeIndexRepository)
    .lexical(
      { userId, filters: { resourceTypes: ["source", "memory"], excludeConfidential: true } },
      ftsQuery,
    );

  return passages.map(({ sourceId, resourceType, title, content, updatedAt }) => ({
    sourceId,
    resourceType,
    title,
    content,
    updatedAt,
  }));
}
