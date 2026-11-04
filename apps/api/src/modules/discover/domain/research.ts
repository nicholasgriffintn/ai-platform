import { DISCOVER_RESEARCH_DAYS_KEPT } from "@ngriffin_uk/polychat-schemas";
import {
  headlineTerms,
  isBoilerplate,
  isRecord,
  leadParagraphs,
  markdownToPlainText,
  readUrlHost,
  shiftCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

import { mergeDailyLog, parseDailyLog, renderDailyLog } from "./daily-log";
import { discoverTopicKey } from "./edition";

export const DISCOVER_HEADLINES_TOPIC = "Today's headlines";
const RESEARCH_CURRENT_DAYS = 1;
const RESEARCH_NOISE_HOSTS = [
  "accessnewswire.com",
  "businesswire.com",
  "einnews.com",
  "einpresswire.com",
  "globenewswire.com",
  "openpr.com",
  "prnewswire.com",
  "prweb.com",
  "reutersconnect.com",
];
const RESEARCH_NOISE_TITLES = [
  /^(?:the )?\d+ (?:best|top)\b/iu,
  /^(?:the )?best\b.*\b20\d{2}\b/iu,
  /^licensable (?:image|picture)\b/iu,
];

export type DiscoverResultMedia = "watch" | "listen";

export interface DiscoverResearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  media?: DiscoverResultMedia;
}

function readResultMedia(value: unknown): DiscoverResultMedia | undefined {
  return value === "watch" || value === "listen" ? value : undefined;
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
            ...(readResultMedia(entry.media) ? { media: readResultMedia(entry.media) } : {}),
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

function isResearchNoise(result: DiscoverResearchResult): boolean {
  const host = readUrlHost(result.url).toLowerCase();

  return (
    RESEARCH_NOISE_HOSTS.some((noise) => host === noise || host.endsWith(`.${noise}`)) ||
    RESEARCH_NOISE_TITLES.some((title) => title.test(result.title))
  );
}

export function keepDiscoverTopicResults<T extends DiscoverResearchResult>(
  topic: string,
  results: readonly T[],
): T[] {
  const terms = [...headlineTerms(topic)];
  const needed = Math.ceil(terms.length / 2);

  return results.filter((result) => {
    const text = headlineTerms(`${result.title} ${result.snippet}`);

    return !isResearchNoise(result) && terms.filter((term) => text.has(term)).length >= needed;
  });
}

export function keepRecentDiscoverResults(
  documents: readonly DiscoverCurrentResearch[],
  today: string,
): DiscoverCurrentResearch[] {
  const earliest = shiftCalendarDate(today, -RESEARCH_CURRENT_DAYS);

  return documents.map((document) => ({
    ...document,
    results: document.results.filter((result) => !result.date || result.date >= earliest),
  }));
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
