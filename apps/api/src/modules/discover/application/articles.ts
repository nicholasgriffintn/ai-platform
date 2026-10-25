import { DISCOVER_ARTICLE_METADATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DiscoverResearchResult } from "~/modules/discover/domain/research";
import { gatherKnowledgeArticles } from "~/modules/sources/application/knowledge/articles";
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
      readLimit: ARTICLE_READ_LIMIT,
      summarise: true,
      metadata: () => ({
        [DISCOVER_ARTICLE_METADATA_KEY]: { topic: input.topic, date: input.date },
      }),
    },
  );

  return gathered.map(({ sourceId: _sourceId, ...result }) => result);
}
