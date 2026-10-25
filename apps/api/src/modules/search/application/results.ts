import type { NotebookResearchResult } from "@ngriffin_uk/polychat-schemas";
import {
  DAY_MS,
  markdownToPlainText,
  publishedCalendarDate,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { handleWebSearch } from "./web";

const SEARCH_RESULT_LIMIT = 10;
const NEWS_DATE_SLACK_DAYS = 1;

export interface NewsResult extends NotebookResearchResult {
  source: string;
  date: string;
}

export interface NewsSearch {
  days: number;
  country?: string | null;
  language?: string;
  now?: number;
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

export function withinNewsWindow(
  results: readonly NewsResult[],
  days: number,
  now: number,
): NewsResult[] {
  const earliest = new Date(now - (days + NEWS_DATE_SLACK_DAYS) * DAY_MS)
    .toISOString()
    .slice(0, 10);

  return results.filter((result) => result.date !== "" && result.date >= earliest);
}

export async function findNewsResults(
  context: ServiceContext,
  query: string,
  { days, country, language, now = Date.now() }: NewsSearch,
): Promise<NewsResult[]> {
  const response = await handleWebSearch({
    env: context.env,
    user: context.requireUser(),
    query,
    options: {
      topic: "news",
      days,
      max_results: SEARCH_RESULT_LIMIT,
      ...(country ? { country } : {}),
      ...(language ? { language } : {}),
    },
  });

  return withinNewsWindow(
    readResults(response.data.sources, (source) => ({
      ...describeResult(source),
      source: (source.publisher || readUrlHost(source.url)).slice(0, 80),
      date: publishedCalendarDate(source.publishedDate, now),
    })),
    days,
    now,
  );
}
