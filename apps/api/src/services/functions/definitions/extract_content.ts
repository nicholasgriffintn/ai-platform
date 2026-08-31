import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const extract_content: FunctionToolDescriptor = {
  name: "extract_content",
  description:
    "Extracts and analyzes web content from provided URLs. Supports Tavily extraction and Cloudflare Browser Rendering endpoints (including crawl). Can process multiple URLs and optionally store content in vector memory.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      urls: {
        type: "string",
        description: "Single URL or comma-separated list of URLs to extract content from",
      },
      extract_depth: {
        type: "string",
        description:
          "The depth of extraction - 'basic' for main content or 'advanced' for more comprehensive extraction",
        default: "basic",
      },
      include_images: {
        type: "boolean",
        description: "Whether to include images from the content",
        default: false,
      },
      should_vectorize: {
        type: "boolean",
        description: "Whether to store the content in the vector database for future reference",
        default: false,
      },
      provider: {
        type: "string",
        enum: ["auto", "tavily", "cloudflare"],
        description:
          "Extraction provider. Use 'cloudflare' for Browser Rendering endpoints or 'auto' to choose based on configured keys.",
        default: "auto",
      },
      cloudflareFormat: {
        type: "string",
        enum: ["markdown", "content", "json", "links", "scrape", "snapshot"],
        description: "Browser Rendering endpoint format when provider is 'cloudflare'.",
        default: "markdown",
      },
      cloudflareJsonOptions: {
        type: "object",
        description:
          "Optional /json endpoint options such as prompt, response_format, or custom_ai.",
      },
      cloudflareScrapeOptions: {
        type: "object",
        description:
          "Optional /scrape endpoint configuration. Pass an elements array of selector objects.",
      },
      cloudflareCrawlOptions: {
        type: "object",
        description:
          "Optional /crawl settings. Set enabled=true to crawl from the first URL asynchronously.",
      },
    },
    required: ["urls"],
  }),
  type: "premium",
  permissions: ["read", "write"],
};
