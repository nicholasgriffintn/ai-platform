import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { Readability } from "readability";
import TurndownService from "turndown";

import { config } from "./config.js";
import { extractDomain, generateExcerpt, validateUrl } from "./utils.js";

class WebAgent {
  constructor() {
    this.turndownService = new TurndownService();
  }

  async searchWeb(query, maxResults = 5) {
    try {
      // Mock search results for demo (in production, you'd use Google Custom Search API, Bing API, etc.)
      const mockResults = this.generateMockSearchResults(query, maxResults);

      // Fetch actual content for some results
      const resultsWithContent = await Promise.allSettled(
        mockResults.slice(0, Math.min(3, maxResults)).map(async (result) => {
          try {
            const content = await this.scrapeUrl(result.url);
            return {
              ...result,
              content: content.content,
              excerpt: content.excerpt,
            };
          } catch (error) {
            console.warn(`Failed to scrape ${result.url}:`, error.message);
            return {
              ...result,
              content: "",
              excerpt: result.snippet,
            };
          }
        }),
      );

      return {
        search_results: mockResults,
        sources: resultsWithContent
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value),
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async scrapeUrl(url) {
    try {
      console.log(`Scraping URL: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": config.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
        },
        timeout: config.requestTimeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $(config.elementsToRemove).remove();

      // Extract title
      const title =
        $("title").text().trim() || $("h1").first().text().trim() || "Untitled";

      // Use Readability for main content extraction
      let mainContent = "";
      let excerpt = "";

      try {
        const readabilityResult = new Readability(html, { url }).parse();
        if (readabilityResult) {
          mainContent =
            readabilityResult.textContent || readabilityResult.content || "";
          excerpt = generateExcerpt(mainContent);
        }
      } catch (readabilityError) {
        console.warn("Readability failed, falling back to basic extraction");
      }

      if (!mainContent) {
        let contentElement = null;
        for (const selector of config.contentSelectors) {
          contentElement = $(selector).first();
          if (contentElement.length > 0) break;
        }

        if (!contentElement || contentElement.length === 0) {
          contentElement = $("body");
        }

        mainContent = contentElement.text().replace(/\s+/g, " ").trim();
        excerpt = generateExcerpt(mainContent);
      }

      // Extract metadata
      const description =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";

      const keywords = $('meta[name="keywords"]').attr("content") || "";

      return {
        url,
        title,
        content: mainContent.substring(0, config.maxContentLength),
        excerpt: excerpt || description.substring(0, config.maxExcerptLength),
        description,
        keywords,
        scraped_at: new Date().toISOString(),
        word_count: mainContent.split(" ").length,
      };
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error.message);
      throw new Error(`Scraping failed for ${url}: ${error.message}`);
    }
  }

  async scrapeMultipleUrls(urls) {
    const results = await Promise.allSettled(
      urls.map((url) => this.scrapeUrl(url)),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        url: urls[index],
        title: "Failed to scrape",
        content: "",
        excerpt: "",
        error: result.reason.message,
        scraped_at: new Date().toISOString(),
      };
    });
  }

  generateMockSearchResults(query, maxResults) {
    // In a real implementation, this would call a search API
    const baseResults = [
      {
        title: `Understanding ${query} - Comprehensive Guide`,
        url:
          "https://example.com/guide-" +
          encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-")),
        snippet: `Comprehensive guide about ${query} covering all the essential aspects and latest developments.`,
      },
      {
        title: `${query} - Wikipedia`,
        url:
          "https://en.wikipedia.org/wiki/" +
          encodeURIComponent(query.replace(/\s+/g, "_")),
        snippet: `Wikipedia article about ${query} with detailed information and references.`,
      },
      {
        title: `Latest News on ${query}`,
        url:
          "https://news.example.com/" +
          encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-")),
        snippet: `Recent news and updates about ${query} from reliable sources.`,
      },
      {
        title: `${query} Research Papers and Studies`,
        url:
          "https://scholar.example.com/search?q=" + encodeURIComponent(query),
        snippet: `Academic research papers and scientific studies related to ${query}.`,
      },
      {
        title: `${query} Tutorial and How-to Guide`,
        url:
          "https://tutorial.example.com/" +
          encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-")),
        snippet: `Step-by-step tutorial and practical guide for ${query}.`,
      },
    ];

    return baseResults.slice(0, maxResults);
  }

  validateUrl(url) {
    return validateUrl(url);
  }

  extractDomain(url) {
    return extractDomain(url);
  }
}

export { WebAgent };
