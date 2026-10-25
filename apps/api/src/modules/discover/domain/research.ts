import { DISCOVER_RESEARCH_DAYS_KEPT } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export const DISCOVER_HEADLINES_TOPIC = "Today's headlines";

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

const SECTION_HEADING = /^## (\d{4}-\d{2}-\d{2})$/u;
const RESULT_LINE =
  /^- \[(.+?)\]\((https?:\/\/\S+?)\)(?: _\((.+?)(?: · (\d{4}-\d{2}-\d{2}))?\)_)?(?: — (.*))?$/u;

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

export function renderResearchSection(section: DiscoverResearchSection): string {
  return [
    `## ${section.date}`,
    ...section.results.map(
      (result) =>
        `- [${result.title.replace(/[[\]]/gu, "")}](${result.url})${describeOrigin(result)}${
          result.snippet ? ` — ${result.snippet.replace(/\s+/gu, " ").trim()}` : ""
        }`,
    ),
  ].join("\n");
}

export function parseResearchDocument(content: string): DiscoverResearchSection[] {
  const sections: DiscoverResearchSection[] = [];

  for (const line of content.split("\n")) {
    const heading = SECTION_HEADING.exec(line.trim());

    if (heading?.[1]) {
      sections.push({ date: heading[1], results: [] });
      continue;
    }

    const result = RESULT_LINE.exec(line.trim());
    const current = sections.at(-1);

    if (result && current) {
      current.results.push({
        title: result[1] ?? "",
        url: result[2] ?? "",
        snippet: result[5] ?? "",
        ...(result[3] ? { source: result[3] } : {}),
        ...(result[4] ? { date: result[4] } : {}),
      });
    }
  }

  return sections;
}

export function mergeResearchDocument(existing: string, section: DiscoverResearchSection): string {
  const kept = parseResearchDocument(existing).filter((item) => item.date !== section.date);
  const seen = new Set(kept.flatMap((item) => item.results.map((result) => result.url)));
  const fresh = {
    date: section.date,
    results: section.results.filter((result) => {
      if (seen.has(result.url)) {
        return false;
      }

      seen.add(result.url);

      return true;
    }),
  };

  return [fresh, ...kept]
    .sort((left, right) => (left.date < right.date ? 1 : -1))
    .slice(0, DISCOVER_RESEARCH_DAYS_KEPT)
    .map(renderResearchSection)
    .join("\n\n");
}

export function latestResearchSection(content: string): DiscoverResearchSection | null {
  return parseResearchDocument(content)[0] ?? null;
}
