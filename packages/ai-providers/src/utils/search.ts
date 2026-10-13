import {
  getStringProperty,
  readFiniteNumber,
  readRecord,
  readStringArray,
} from "@ngriffin_uk/polychat-utility-core";

import type { SearchResult } from "../types/search.js";
import { readPublicSearchUrl } from "./cloudflare-search.js";

export function normaliseSearchSources(result: SearchResult) {
  const entries =
    "results" in result
      ? result.results
      : "organic" in result
        ? result.organic
        : "citations" in result
          ? result.citations
          : [];

  const isKnowledgeSearch = "provider" in result && result.provider === "cloudflare-ai-search";

  return entries.flatMap((entry) => {
    const data = readRecord(entry);
    const url = getStringProperty(entry, "url") ?? getStringProperty(entry, "link");

    const citationUrl = url && readPublicSearchUrl(url) ? url : "";

    if (!citationUrl && !isKnowledgeSearch) {
      return [];
    }

    const excerpts = readStringArray(data.excerpts);
    const title = getStringProperty(entry, "title");
    const content =
      getStringProperty(entry, "content") ||
      getStringProperty(entry, "relevant_content") ||
      getStringProperty(entry, "snippet") ||
      getStringProperty(entry, "description") ||
      excerpts.join("\n\n") ||
      title ||
      "";

    return [
      {
        title,
        url: citationUrl,
        content,
        excerpts,
        score: readFiniteNumber(data.score),
        chunkId: getStringProperty(entry, "chunkId"),
        image: getStringProperty(entry, "imageUrl") ?? getStringProperty(entry, "image"),
        favicon: getStringProperty(entry, "favicon"),
        publishedDate:
          getStringProperty(entry, "publishedDate") ??
          getStringProperty(entry, "date") ??
          getStringProperty(entry, "last_updated"),
      },
    ];
  });
}
