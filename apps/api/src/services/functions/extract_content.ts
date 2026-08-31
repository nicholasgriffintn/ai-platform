import { createServiceContext } from "~/lib/context/serviceContext";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModelForRetrieval } from "~/lib/providers/models";
import { extractContent } from "~/services/apps/retrieval/content-extract";
import type { Message } from "~/types";

import type { ApiToolDefinition } from "../../types/functions";
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

    const messages: Message[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes web content. Focus on providing accurate, relevant information while maintaining proper citation of sources.",
      },
      {
        role: "user",
        content: `Please summarize the content from the following URLs:\n\nExtracted Content:\n${result.data?.extracted.results
          .map((r, i) => `[${i + 1}] URL: ${r.url}\n${r.raw_content}\n`)
          .join("\n\n")}`,
      },
    ];

    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModelForRetrieval(
      env,
      user,
    );
    const provider = getChatProvider(providerToUse, {
      env,
      user,
    });
    const serviceContext = createServiceContext({ env, user });

    const aiResponse = await provider.getResponse({
      completion_id,
      app_url,
      context: serviceContext,
      env,
      messages,
      message: `Summarize content from ${urls.join(", ")}`,
      provider: providerToUse,
      model: modelToUse,
    });

    return {
      status: "success",
      name: "extract_content",
      content: aiResponse.response || "Content extracted but no summary could be generated",
      data: {
        ...result.data,
        summary: aiResponse.response,
      },
    };
  },
};
