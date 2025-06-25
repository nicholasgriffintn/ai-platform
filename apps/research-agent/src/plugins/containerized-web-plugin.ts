import { DataCollectorPlugin } from "../core/plugin.js";
import type {
  Artifact,
  ExecutionContext,
  PluginManifest,
  SourceType,
} from "../core/types.js";

export class ContainerizedWebPlugin extends DataCollectorPlugin {
  private webContainer: any;

  constructor(webContainer: any) {
    const manifest: PluginManifest = {
      name: "containerized-web-collector",
      version: "1.0.0",
      description: "Web search and scraping using containerized Node.js agents",
      author: "Research Agent Team",
      type: "data_collector",
      capabilities: [
        {
          name: "web_search",
          description: "Search the web using various search engines",
          inputTypes: ["query"],
          outputTypes: ["search_results"],
        },
        {
          name: "web_scraping",
          description: "Extract content from web pages",
          inputTypes: ["url_list"],
          outputTypes: ["scraped_content"],
        },
        {
          name: "content_validation",
          description: "Validate and clean scraped content",
          inputTypes: ["raw_content"],
          outputTypes: ["validated_content"],
        },
      ],
      dependencies: [
        {
          name: "@cloudflare/containers",
          version: "0.0.12",
          optional: false,
        },
      ],
      configuration: {
        query: {
          type: "string",
          required: true,
          default: "",
          description: "Search query",
        },
        maxSources: {
          type: "number",
          required: false,
          default: 10,
          description: "Maximum number of sources to collect",
        },
        sourceTypes: {
          type: "array",
          required: false,
          default: ["web"],
          description: "Types of sources to search",
        },
        extractContent: {
          type: "boolean",
          required: false,
          default: true,
          description: "Whether to extract full content from pages",
        },
        timeout: {
          type: "number",
          required: false,
          default: 120000,
          description: "Container request timeout in milliseconds",
        },
        languages: {
          type: "array",
          required: false,
          default: ["en"],
          description: "Preferred languages for results",
        },
        domains: {
          type: "object",
          required: false,
          default: {},
          description: "Domain inclusion/exclusion filters",
        },
      },
      endpoints: [
        {
          path: "/scrape",
          method: "POST",
          description: "Scrape content from web sources",
          parameters: [
            {
              name: "urls",
              type: "array",
              required: false,
              description: "URLs to scrape",
            },
            {
              name: "search_query",
              type: "string",
              required: false,
              description: "Search query for finding sources",
            },
            {
              name: "max_results",
              type: "number",
              required: false,
              description: "Maximum number of results",
            },
          ],
          response: {
            type: "object",
            properties: {
              sources: { type: "array" },
              search_results: { type: "array" },
            },
          },
        },
      ],
    };

    super(manifest);
    this.webContainer = webContainer;
  }

  async collect(context: ExecutionContext): Promise<Artifact[]> {
    this.log("info", "Starting containerized web collection", {
      query: this.config.query,
      maxSources: this.config.maxSources,
      stageId: context.stageId,
    });

    const artifacts: Artifact[] = [];

    try {
      // Prepare the web scraping task
      const webTask = this.createWebTask();

      // Call the containerized web service
      const webResult = await this.callWebContainer(webTask);

      if (webResult.success && webResult.data) {
        // Create artifact for search results
        const searchArtifact = this.createArtifact(
          "raw_data",
          "web_search_results",
          {
            query: this.config.query,
            sources: webResult.data.sources || [],
            searchResults: webResult.data.search_results || [],
            totalResults: (webResult.data.sources || []).length,
            collectedAt: new Date().toISOString(),
          },
          {
            format: "json",
            tags: ["web_search", "containerized"],
          },
        );

        artifacts.push(searchArtifact);

        // If content extraction is enabled and we have sources with content
        if (this.config.extractContent && webResult.data.sources) {
          const contentArtifacts = this.createContentArtifacts(
            webResult.data.sources,
          );
          artifacts.push(...contentArtifacts);
        }

        this.log("info", "Web collection completed successfully", {
          artifactCount: artifacts.length,
          sourceCount: (webResult.data.sources || []).length,
          searchResultCount: (webResult.data.search_results || []).length,
        });
      } else {
        this.log("warn", "Web container returned unsuccessful result", {
          error: webResult.error,
        });
      }
    } catch (error) {
      this.log("error", "Web container collection failed", {
        error: error.message,
      });
      throw this.createError(
        "WEB_COLLECTION_FAILED",
        `Containerized web collection failed: ${error.message}`,
        true,
      );
    }

    return artifacts;
  }

  private createWebTask(): WebTask {
    const task: WebTask = {
      max_results: this.config.maxSources as number,
      extract_content: this.config.extractContent as boolean,
    };

    // Add search query if provided
    if (this.config.query) {
      task.search_query = this.config.query as string;
    }

    // Add language preferences
    if (this.config.languages && Array.isArray(this.config.languages)) {
      task.languages = this.config.languages as string[];
    }

    // Add domain filters
    if (this.config.domains && typeof this.config.domains === "object") {
      task.domain_filters = this.config.domains as any;
    }

    return task;
  }

  private async callWebContainer(task: WebTask): Promise<WebContainerResponse> {
    const startTime = performance.now();

    try {
      this.log("debug", "Calling web container", {
        hasQuery: !!task.search_query,
        maxResults: task.max_results,
        extractContent: task.extract_content,
      });

      // Call the containerized web service
      const response = await this.webContainer.fetch(
        "http://localhost:8080/scrape",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
          signal: AbortSignal.timeout(this.config.timeout as number),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Web container responded with status ${response.status}`,
        );
      }

      const result = (await response.json()) as WebContainerResponse;

      const duration = performance.now() - startTime;
      this.metrics.apiCalls++;
      this.metrics.customMetrics["web_container_calls"] =
        (this.metrics.customMetrics["web_container_calls"] || 0) + 1;
      this.metrics.customMetrics["web_container_total_time"] =
        (this.metrics.customMetrics["web_container_total_time"] || 0) +
        duration;

      this.log("debug", "Web container call completed", {
        duration,
        success: result.success,
        sourceCount: result.data?.sources?.length || 0,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.errorCount++;

      this.log("error", "Web container call failed", {
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  private createContentArtifacts(sources: WebSource[]): Artifact[] {
    const contentArtifacts: Artifact[] = [];

    for (const source of sources) {
      if (source.content || source.excerpt) {
        const contentArtifact = this.createArtifact(
          "processed_data",
          `web_content_${this.generateSourceId(source.url)}`,
          {
            url: source.url,
            title: source.title,
            content: source.content || source.excerpt,
            author: source.author,
            publishedAt: source.publishedAt,
            scrapedAt: source.scraped_at,
            metadata: {
              domain: this.extractDomain(source.url),
              language: this.detectLanguage(source.content || source.excerpt),
              wordCount: (source.content || source.excerpt || "").split(/\s+/)
                .length,
              credibilityScore: this.calculateCredibilityScore(source),
              relevanceScore: this.calculateRelevanceScore(source),
            },
          },
          {
            format: "json",
            tags: ["web_content", "scraped", "containerized"],
          },
        );

        contentArtifacts.push(contentArtifact);
      }
    }

    return contentArtifacts;
  }

  private generateSourceId(url: string): string {
    // Create a simple hash-like ID from URL
    return url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  }

  private detectLanguage(content: string): string {
    // Simple language detection based on content
    // In a real implementation, this could use the container's language detection
    if (!content) return "unknown";

    // Very basic detection - could be enhanced
    const commonEnglishWords = [
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ];
    const words = content.toLowerCase().split(/\s+/).slice(0, 50);
    const englishWordCount = words.filter((word) =>
      commonEnglishWords.includes(word),
    ).length;

    return englishWordCount > 3 ? "en" : "unknown";
  }

  private calculateCredibilityScore(source: WebSource): number {
    let score = 0.5; // Base score

    // Boost score for known domains
    const domain = this.extractDomain(source.url);
    const trustedDomains = ["wikipedia.org", "gov", "edu", "org"];
    if (trustedDomains.some((trusted) => domain.includes(trusted))) {
      score += 0.2;
    }

    // Boost score for sources with authors
    if (source.author) {
      score += 0.1;
    }

    // Boost score for recent content
    if (source.publishedAt) {
      const publishDate = new Date(source.publishedAt);
      const daysSincePublish =
        (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublish < 30) {
        score += 0.1;
      }
    }

    return Math.min(1.0, score);
  }

  private calculateRelevanceScore(source: WebSource): number {
    // Simple relevance scoring based on query match
    if (!this.config.query || !source.title) return 0.5;

    const query = (this.config.query as string).toLowerCase();
    const title = source.title.toLowerCase();
    const content = (source.content || source.excerpt || "").toLowerCase();

    let score = 0;

    // Title match
    if (title.includes(query)) score += 0.4;

    // Content match
    if (content.includes(query)) score += 0.3;

    // Word overlap
    const queryWords = query.split(/\s+/);
    const titleWords = title.split(/\s+/);
    const wordOverlap = queryWords.filter((word) =>
      titleWords.includes(word),
    ).length;
    score += (wordOverlap / queryWords.length) * 0.3;

    return Math.min(1.0, score);
  }

  // Health check method for the container
  async checkContainerHealth(): Promise<boolean> {
    try {
      const response = await this.webContainer.fetch(
        "http://localhost:8080/health",
        {
          method: "GET",
          signal: AbortSignal.timeout(5000), // 5 second timeout for health check
        },
      );

      return response.ok;
    } catch (error) {
      this.log("warn", "Web container health check failed", {
        error: error.message,
      });
      return false;
    }
  }
}

interface WebTask {
  urls?: string[];
  search_query?: string;
  max_results?: number;
  extract_content?: boolean;
  languages?: string[];
  domain_filters?: {
    include?: string[];
    exclude?: string[];
  };
}

interface WebSource {
  url: string;
  title: string;
  content?: string;
  excerpt?: string;
  author?: string;
  publishedAt?: string;
  scraped_at: string;
}

interface WebContainerResponse {
  success: boolean;
  data?: {
    sources?: WebSource[];
    search_results?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
  error?: string;
  processing_time_ms: number;
}
