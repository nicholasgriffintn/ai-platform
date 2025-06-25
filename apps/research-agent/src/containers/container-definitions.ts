import { Container } from "@cloudflare/containers";

import type { WebScrapeTask } from "../types/index.js";

export class NLPAgent extends Container {
  override defaultPort = 8080;
  override enableInternet = false;
  override sleepAfter = "5m";

  override onError(error: unknown) {
    console.log("NLP Agent error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      container: "nlp-agent",
    });
  }

  override onStart() {
    console.log("NLP Agent started successfully", {
      timestamp: new Date().toISOString(),
      port: this.defaultPort,
      internetEnabled: this.enableInternet,
    });
  }

  override onStop() {
    console.log("NLP Agent stopped", {
      timestamp: new Date().toISOString(),
      container: "nlp-agent",
    });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch(
        new Request("http://localhost:8080/health", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
      );
      return response.ok;
    } catch (error) {
      console.warn("NLP Agent health check failed:", error);
      return false;
    }
  }

  // Process text with NLP operations
  async processText(text: string, operations: string[]): Promise<any> {
    try {
      const response = await this.fetch(
        new Request("http://localhost:8080/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, operations }),
          signal: AbortSignal.timeout(60000), // 1 minute timeout
        }),
      );

      if (!response.ok) {
        throw new Error(`NLP processing failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("NLP processing error:", error);
      throw error;
    }
  }
}

export class WebAgent extends Container {
  override defaultPort = 8080;
  override enableInternet = true; // Needs internet for web scraping
  override sleepAfter = "5m";

  override onError(error: unknown) {
    console.log("Web Agent error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      container: "web-agent",
    });
  }

  override onStart() {
    console.log("Web Agent started successfully", {
      timestamp: new Date().toISOString(),
      port: this.defaultPort,
      internetEnabled: this.enableInternet,
    });
  }

  override onStop() {
    console.log("Web Agent stopped", {
      timestamp: new Date().toISOString(),
      container: "web-agent",
    });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch(
        new Request("http://localhost:8080/health", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
      );
      return response.ok;
    } catch (error) {
      console.warn("Web Agent health check failed:", error);
      return false;
    }
  }

  // Scrape web content
  async scrapeContent(task: WebScrapeTask): Promise<any> {
    try {
      const response = await this.fetch(
        new Request("http://localhost:8080/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
          signal: AbortSignal.timeout(120000), // 2 minute timeout
        }),
      );

      if (!response.ok) {
        throw new Error(`Web scraping failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Web scraping error:", error);
      throw error;
    }
  }
}
