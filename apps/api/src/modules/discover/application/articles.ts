import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_ARTICLE_METADATA_KEY,
  SOURCE_SUMMARY_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl, resolveHttpUrl, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DiscoverResearchResult } from "~/modules/discover/domain/research";
import { buildSourceSummary } from "~/modules/sources/application/summary";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { readPageContents } from "~/modules/tools/application/retrieval/page-contents";

import { findDiscoverNotebook } from "./notebook";
import { writeDiscoverDocument } from "./signal-documents";

const logger = getLogger({ prefix: "discover/articles" });
const ARTICLE_READ_LIMIT = 6;

async function articleSourceId(userId: number, url: string): Promise<string> {
  return `discover_article_${(await sha256Hex(`${userId}:${url}`)).slice(0, 24)}`;
}

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
  const user = context.requireUser();
  let contentByUrl: Map<string, string>;

  try {
    contentByUrl = await readPageContents(
      context,
      input.results.slice(0, ARTICLE_READ_LIMIT).map((result) => result.url),
    );
  } catch (error) {
    logger.warn("Discover could not read the pages for a topic", {
      topic: input.topic,
      error_message: getErrorMessage(error),
    });

    return [...input.results];
  }

  const readAt = new Date().toISOString();
  const read: DiscoverResearchResult[] = [];

  for (const result of input.results) {
    const url = resolveHttpUrl(result.url);
    const content = url ? contentByUrl.get(url) : undefined;

    if (!url || !content) {
      read.push(result);
      continue;
    }

    const summary = await buildSourceSummary(context, content, null).catch((error: unknown) => {
      logger.warn("A Discover article could not be summarised", {
        url,
        error_message: getErrorMessage(error),
      });

      return null;
    });

    try {
      await writeDiscoverDocument(context, notebookId, {
        id: await articleSourceId(user.id, url),
        kind: "url",
        title: result.title.slice(0, 200),
        provider: "web",
        externalUri: url,
        content,
        metadata: {
          [DISCOVER_ARTICLE_METADATA_KEY]: { topic: input.topic, date: input.date },
          ...(result.source ? { source: result.source } : {}),
          ...(summary ? { [SOURCE_SUMMARY_METADATA_KEY]: summary } : {}),
          readAt,
        },
      });
    } catch (error) {
      logger.warn("A Discover article could not be filed", {
        url,
        error_message: getErrorMessage(error),
      });
    }

    read.push(summary ? { ...result, snippet: summary.summary } : result);
  }

  return read;
}
