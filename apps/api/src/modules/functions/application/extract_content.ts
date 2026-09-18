import { buildContentExtractionPrompt } from "@ngriffin_uk/polychat-ai-prompts";

import { ai } from "~/infrastructure/ai";
import { extractContent } from "~/modules/apps/application/retrieval/content-extract";
import { getAuxiliaryModelForRetrieval } from "~/modules/models/application/resolve";
import type { ApiToolDefinition } from "~/types/functions";

import { extract_content as extract_contentDescriptor } from "./definitions/extract_content";

export const extract_content: ApiToolDefinition = {
  ...extract_contentDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const app_url = context.appUrl ?? req.app_url;
    const env = context.env ?? req.env;
    const user = context.user ?? req.user;

    const urls = args.urls
      .split(",")
      .map((url: string) => url.trim())
      .filter(Boolean);

    if (urls.length === 0 || urls.length > 10) {
      return {
        status: "error",
        name: "extract_content",
        content: "Provide between 1 and 10 URLs",
        data: {},
      };
    }

    const result = await extractContent(
      {
        urls,
        extract_depth: args.extract_depth,
        include_images: args.include_images,
        should_vectorize: args.should_vectorize,
        provider: args.provider,
        cloudflareFormat: args.cloudflareFormat,
        cloudflareJsonOptions: args.cloudflareJsonOptions,
        cloudflareScrapeOptions: args.cloudflareScrapeOptions,
        cloudflareCrawlOptions: args.cloudflareCrawlOptions,
      },
      req,
    );

    if (result.status === "error") {
      return {
        status: "error",
        name: "extract_content",
        content: result.error || "Unknown error occurred",
        data: {},
      };
    }

    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModelForRetrieval(
      env,
      user,
    );
    const summary = await ai.generateText({
      env,
      user,
      model: modelToUse,
      provider: providerToUse,
      completion_id,
      app_url,
      system: buildContentExtractionPrompt(),
      prompt: `Please summarize the content from the following URLs:\n\nExtracted Content:\n${result.data?.extracted.results
        .map((r, i) => `[${i + 1}] URL: ${r.url}\n${r.raw_content}\n`)
        .join("\n\n")}`,
    });

    return {
      status: "success",
      name: "extract_content",
      content: summary || "Content extracted but no summary could be generated",
      data: {
        ...result.data,
        summary,
      },
    };
  },
};
