import {
  DISCOVER_ARTICLE_METADATA_KEY,
  DISCOVER_RESEARCH_DAYS_KEPT,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DiscoverResearchResult } from "~/modules/discover/domain/research";
import { setKnowledgeDocumentControls } from "~/modules/knowledge/application/control/controls";
import { gatherKnowledgeArticles } from "~/modules/knowledge/application/intake/articles";
import { knowledgeSourceId } from "~/modules/knowledge/application/intake/commit";
import { readKnowledgeExpiry } from "~/modules/knowledge/domain/envelope";
import { knowledgeArticleKey } from "~/modules/knowledge/domain/item";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { findDiscoverNotebook } from "./notebook";
import { discoverKnowledgeTarget } from "./signal-documents";

const ARTICLE_READ_LIMIT = 6;

export async function listDiscoverArticleSources(
  context: ServiceContext,
): Promise<Map<string, string>> {
  const user = context.requireUser();
  const notebook = await findDiscoverNotebook(context, user.id);

  if (!notebook) {
    return new Map();
  }

  const sources = await context.repositories
    .get(SourceRepository)
    .listCollectionSources(notebook.id);
  const byUrl = new Map<string, string>();

  for (const source of sources) {
    const url = source.external_uri ? comparableHttpUrl(source.external_uri) : null;

    if (url && parseJsonRecord(source.metadata)[DISCOVER_ARTICLE_METADATA_KEY] !== undefined) {
      byUrl.set(url, source.id);
    }
  }

  return byUrl;
}

export async function readDiscoverArticles(
  context: ServiceContext,
  notebookId: string,
  input: { topic: string; date: string; results: readonly DiscoverResearchResult[] },
): Promise<DiscoverResearchResult[]> {
  const gathered = await gatherKnowledgeArticles(
    context,
    await discoverKnowledgeTarget(context, notebookId),
    input.results,
    {
      origin: "page",
      readLimit: ARTICLE_READ_LIMIT,
      summarise: true,
      keepDays: DISCOVER_RESEARCH_DAYS_KEPT,
      metadata: () => ({
        [DISCOVER_ARTICLE_METADATA_KEY]: { topic: input.topic, date: input.date },
      }),
    },
  );

  return gathered.map(({ sourceId: _sourceId, ...result }) => result);
}

export async function keepDiscoverPage(context: ServiceContext, url: string): Promise<void> {
  const key = knowledgeArticleKey(url);

  if (!key) {
    return;
  }

  const user = context.requireUser();
  const sourceId = await knowledgeSourceId({ userId: user.id, projectId: null }, key);
  const source = await context.repositories.get(SourceRepository).getSource(sourceId);

  if (
    source?.created_by_user_id === user.id &&
    readKnowledgeExpiry(parseJsonRecord(source.metadata))
  ) {
    await setKnowledgeDocumentControls(context, sourceId, { expiresAt: null });
  }
}
