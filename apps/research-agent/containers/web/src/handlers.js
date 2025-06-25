import {
  createErrorResponse,
  createSuccessResponse,
  measureTime,
} from "./utils.js";
import { WebAgent } from "./web-agent.js";

const webAgent = new WebAgent();

export async function handleScrape(c) {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const { urls, search_query, max_results, extract_content } = body;

    const result = {
      sources: [],
      search_results: [],
    };

    if (search_query) {
      console.log(`Processing search query: ${search_query}`);
      const searchResult = await webAgent.searchWeb(
        search_query,
        max_results || 5,
      );
      result.search_results = searchResult.search_results;
      if (extract_content) {
        result.sources = searchResult.sources;
      }
    }

    if (urls && Array.isArray(urls) && urls.length > 0) {
      console.log(`Scraping ${urls.length} URLs`);

      const validUrls = urls.filter((url) => webAgent.validateUrl(url));
      if (validUrls.length === 0) {
        throw new Error("No valid URLs provided");
      }

      const scrapedData = await webAgent.scrapeMultipleUrls(validUrls);
      result.sources = [...(result.sources || []), ...scrapedData];
    }

    if (result.sources.length === 0 && result.search_results.length === 0) {
      throw new Error("No URLs or search query provided");
    }

    return c.json(createSuccessResponse(result, measureTime(startTime)));
  } catch (error) {
    console.error("Web scraping error:", error);
    return c.json(createErrorResponse(error, measureTime(startTime)), 500);
  }
}

export async function handleUrl(c) {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      throw new Error("URL is required");
    }

    if (!webAgent.validateUrl(url)) {
      throw new Error("Invalid URL provided");
    }

    const result = await webAgent.scrapeUrl(url);
    return c.json(createSuccessResponse(result, measureTime(startTime)));
  } catch (error) {
    console.error("URL scraping error:", error);
    return c.json(createErrorResponse(error, measureTime(startTime)), 500);
  }
}

export async function handleSearch(c) {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const { query, max_results } = body;

    if (!query) {
      throw new Error("Search query is required");
    }

    const result = await webAgent.searchWeb(query, max_results || 5);
    return c.json(createSuccessResponse(result, measureTime(startTime)));
  } catch (error) {
    console.error("Search error:", error);
    return c.json(createErrorResponse(error, measureTime(startTime)), 500);
  }
}

export function handleValidate(c) {
  try {
    const url = decodeURIComponent(c.req.param("url"));
    const isValid = webAgent.validateUrl(url);
    const domain = webAgent.extractDomain(url);

    return c.json({
      url,
      valid: isValid,
      domain,
    });
  } catch (error) {
    return c.json(
      {
        error: `URL validation failed: ${error.message}`,
      },
      400,
    );
  }
}
