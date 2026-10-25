import type { NotebookResearchResult } from "@ngriffin_uk/polychat-schemas";
import {
  markdownToPlainText,
  publishedCalendarDate,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { handleWebSearch } from "./web";

const SEARCH_RESULT_LIMIT = 10;

export interface NewsResult extends NotebookResearchResult {
  source: string;
  date: string;
}

type WebSearchSource = Awaited<ReturnType<typeof handleWebSearch>>["data"]["sources"][number];

function readResults<TResult>(
  sources: readonly WebSearchSource[],
  toResult: (source: WebSearchSource & { url: string }) => TResult,
): TResult[] {
  const seen = new Set<string>();
  const results: TResult[] = [];

  for (const source of sources) {
    if (!source.url || seen.has(source.url)) {
      continue;
    }

    seen.add(source.url);
    results.push(toResult({ ...source, url: source.url }));
  }

  return results.slice(0, SEARCH_RESULT_LIMIT);
}

function describeResult(source: WebSearchSource & { url: string }): NotebookResearchResult {
  return {
    title: (source.title || source.url).slice(0, 200),
    url: source.url,
    snippet: truncateSingleLine(markdownToPlainText(source.content), 1_000),
  };
}

export async function findWebResults(
  context: ServiceContext,
  query: string,
): Promise<NotebookResearchResult[]> {
  const response = await handleWebSearch({ env: context.env, user: context.requireUser(), query });

  return readResults(response.data.sources, describeResult);
}

export async function findNewsResults(
  context: ServiceContext,
  query: string,
  days: number,
  now = Date.now(),
): Promise<NewsResult[]> {
  const response = await handleWebSearch({
    env: context.env,
    user: context.requireUser(),
    query,
    options: { topic: "news", days, max_results: SEARCH_RESULT_LIMIT },
  });

  return readResults(response.data.sources, (source) => ({
    ...describeResult(source),
    source: (source.publisher || readUrlHost(source.url)).slice(0, 80),
    date: publishedCalendarDate(source.publishedDate, now),
  }));
}
