import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { DISCOVER_ARTICLE_METADATA_KEY } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  leadParagraphs,
  markdownToPlainText,
  sha256Hex,
  truncateForModel,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DiscoverResearchResult } from "~/modules/discover/domain/research";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { extractContent } from "~/modules/tools/application/retrieval/content-extract";

import { findDiscoverNotebook } from "./notebook";
import { writeDiscoverDocument } from "./signal-documents";

const logger = getLogger({ prefix: "discover/articles" });
const ARTICLE_READ_LIMIT = 6;
const ARTICLE_EXCERPT_CHARACTERS = 900;
const ARTICLE_CONTENT_CHARACTERS = 60_000;

async function articleSourceId(userId: number, url: string): Promise<string> {
  return `discover_article_${(await sha256Hex(`${userId}:${url}`)).slice(0, 24)}`;
}

function normaliseUrl(url: string): string | null {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export function excerptArticle(content: string): string {
  return leadParagraphs(markdownToPlainText(content), ARTICLE_EXCERPT_CHARACTERS);
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
  const urls = input.results
    .slice(0, ARTICLE_READ_LIMIT)
    .map((result) => normaliseUrl(result.url))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    return [...input.results];
  }

  let contentByUrl = new Map<string, string>();

  try {
    const extracted = await extractContent({ urls }, { env: context.env, user, context });

    if (extracted.status !== "error" && extracted.data) {
      contentByUrl = new Map(
        extracted.data.extracted.results.flatMap((page) =>
          page.raw_content?.trim() ? [[page.url, page.raw_content] as const] : [],
        ),
      );
    }
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
    const url = normaliseUrl(result.url);
    const content = url ? contentByUrl.get(url) : undefined;

    if (!url || !content) {
      read.push(result);
      continue;
    }

    try {
      await writeDiscoverDocument(context, notebookId, {
        id: await articleSourceId(user.id, url),
        kind: "url",
        title: result.title.slice(0, 200),
        provider: "web",
        externalUri: url,
        content: truncateForModel(content, ARTICLE_CONTENT_CHARACTERS),
        metadata: {
          [DISCOVER_ARTICLE_METADATA_KEY]: { topic: input.topic, date: input.date },
          ...(result.source ? { source: result.source } : {}),
          readAt,
        },
      });
    } catch (error) {
      logger.warn("A Discover article could not be filed", {
        url,
        error_message: getErrorMessage(error),
      });
    }

    const excerpt = excerptArticle(content);

    read.push(excerpt ? { ...result, snippet: excerpt } : result);
  }

  return read;
}
