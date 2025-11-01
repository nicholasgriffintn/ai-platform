import type {
  DuckDuckGoSearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "~/types";

const stripHtml = (value?: string) =>
  value?.replace(/<[^>]*>/g, "").trim() ?? "";

export class DuckDuckGoProvider implements SearchProvider {
  async performWebSearch(
    query: string,
    _options?: SearchOptions,
  ): Promise<SearchResult> {
    const url = new URL("https://api.https://duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("no_redirect", "1");

    try {
      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          status: "error",
          error: `Error performing web search: ${error}`,
        };
      }

      const raw = (await response.json()) as Record<string, any>;

      const results: DuckDuckGoSearchResult["results"] = [];

      const addResult = (item: {
        Text?: string;
        FirstURL?: string;
        Icon?: { URL?: string };
        Result?: string;
        Name?: string;
      }) => {
        const text = stripHtml(item.Text || item.Result || "");
        const title = stripHtml(item.Name || text || query);
        const urlValue =
          item.FirstURL ||
          raw.AbstractURL ||
          raw.Redirect ||
          `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

        if (!text && !title && !urlValue) {
          return;
        }

        results.push({
          title: title || text || query,
          url: urlValue,
          content: text || title,
          excerpts: text ? [text] : [],
          icon: item.Icon?.URL,
        });
      };

      if (raw.AbstractText || raw.Abstract) {
        results.push({
          title: raw.Heading || stripHtml(raw.AbstractSource) || query,
          url: raw.AbstractURL || raw.Redirect || "",
          content: stripHtml(raw.AbstractText || raw.Abstract),
          excerpts: [stripHtml(raw.AbstractText || raw.Abstract)].filter(
            (value) => value.length > 0,
          ),
        });
      }

      if (Array.isArray(raw.Results)) {
        for (const result of raw.Results) {
          addResult(result);
        }
      }

      if (Array.isArray(raw.RelatedTopics)) {
        for (const topic of raw.RelatedTopics) {
          if (Array.isArray(topic.Topics)) {
            for (const nestedTopic of topic.Topics) {
              addResult({ ...nestedTopic, Name: topic.Name });
            }
          } else {
            addResult(topic);
          }
        }
      }

      const answer = stripHtml(
        raw.Answer || raw.AbstractText || raw.Definition,
      );

      if (results.length === 0 && answer) {
        results.push({
          title: raw.Heading || query,
          url:
            raw.AbstractURL ||
            raw.Redirect ||
            `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          content: answer,
          excerpts: [answer],
        });
      }

      if (results.length === 0) {
        results.push({
          title: raw.Heading || query,
          url:
            raw.AbstractURL ||
            raw.Redirect ||
            `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          content: query,
          excerpts: [query],
        });
      }

      const normalized: DuckDuckGoSearchResult = {
        results,
        answer: answer || undefined,
        raw,
      };

      return normalized;
    } catch (error) {
      return {
        status: "error",
        error:
          error instanceof Error
            ? `Error performing web search: ${error.message}`
            : "Error performing web search",
      };
    }
  }
}
