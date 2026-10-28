import { DISCOVER_RESEARCH_DAYS_KEPT } from "@ngriffin_uk/polychat-schemas";
import {
  isBoilerplate,
  isRecord,
  leadParagraphs,
  markdownToPlainText,
  shiftCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

import { mergeDailyLog, parseDailyLog, renderDailyLog } from "./daily-log";
import { discoverTopicKey } from "./edition";

export const DISCOVER_HEADLINES_TOPIC = "Today's headlines";
const RESEARCH_CURRENT_DAYS = 1;

export interface DiscoverResearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

export interface DiscoverResearchSection {
  date: string;
  results: DiscoverResearchResult[];
}

export interface DiscoverCurrentResearch extends DiscoverResearchSection {
  topic: string;
}

const RESULT_LINE =
  /^\[(.+?)\]\((https?:\/\/\S+?)\)(?: _\((.+?)(?: · (\d{4}-\d{2}-\d{2}))?\)_)?(?: — (.*))?$/u;

function cleanSnippet(value: string): string {
  const text = markdownToPlainText(value).replace(/\s+/gu, " ").trim();

  return leadParagraphs(text, 1_000) || (isBoilerplate(text) ? "" : text);
}

function describeOrigin(result: DiscoverResearchResult): string {
  const source =
    result.source
      ?.replace(/[()_·]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim() ?? "";

  if (!source) {
    return "";
  }

  return ` _(${source}${result.date ? ` · ${result.date}` : ""})_`;
}

export function readResearchResults(value: unknown): DiscoverResearchResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) =>
    isRecord(entry) && typeof entry.title === "string" && typeof entry.url === "string"
      ? [
          {
            title: entry.title,
            url: entry.url,
            snippet: typeof entry.snippet === "string" ? entry.snippet : "",
            ...(typeof entry.source === "string" ? { source: entry.source } : {}),
            ...(typeof entry.date === "string" ? { date: entry.date } : {}),
          },
        ]
      : [],
  );
}

function renderResearchLine(result: DiscoverResearchResult): string {
  return `[${result.title.replace(/[[\]]/gu, "")}](${result.url})${describeOrigin(result)}${
    result.snippet ? ` — ${result.snippet}` : ""
  }`;
}

function parseResearchLine(line: string): DiscoverResearchResult[] {
  const result = RESULT_LINE.exec(line);

  return result
    ? [
        {
          title: result[1] ?? "",
          url: result[2] ?? "",
          snippet: cleanSnippet(result[5] ?? ""),
          ...(result[3] ? { source: result[3] } : {}),
          ...(result[4] ? { date: result[4] } : {}),
        },
      ]
    : [];
}

export function parseResearchDocument(content: string): DiscoverResearchSection[] {
  return parseDailyLog(content).map((day) => ({
    date: day.date,
    results: day.lines.flatMap(parseResearchLine),
  }));
}

export function mergeResearchDocument(existing: string, section: DiscoverResearchSection): string {
  const days = parseDailyLog(existing);
  const seen = new Set(
    parseResearchDocument(existing)
      .filter((kept) => kept.date !== section.date)
      .flatMap((kept) => kept.results.map((result) => result.url)),
  );
  const fresh = section.results.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }

    seen.add(result.url);

    return true;
  });

  return renderDailyLog(
    mergeDailyLog(
      days,
      { date: section.date, lines: fresh.map(renderResearchLine) },
      DISCOVER_RESEARCH_DAYS_KEPT,
    ),
  );
}

export function latestResearchSection(content: string): DiscoverResearchSection | null {
  return parseResearchDocument(content)[0] ?? null;
}

export function selectCurrentResearch(
  documents: ReadonlyArray<{ topic: string; content: string }>,
  { today, hiddenTopics }: { today: string; hiddenTopics: ReadonlySet<string> },
): DiscoverCurrentResearch[] {
  const earliest = shiftCalendarDate(today, -RESEARCH_CURRENT_DAYS);

  return documents.flatMap((document) => {
    const section = hiddenTopics.has(discoverTopicKey(document.topic))
      ? null
      : latestResearchSection(document.content);

    return section && section.date >= earliest && section.results.length > 0
      ? [{ topic: document.topic, ...section }]
      : [];
  });
}
