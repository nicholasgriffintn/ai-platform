import { summariseArticlePrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/providers/factory";
import type { IEnv } from "~/types";
import { extractQuotes } from "~/utils/extract";
import { verifyQuotes } from "~/utils/verify";

export interface Params {
  article: string;
}

export interface Response {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function summariseArticle({
  completion_id,
  app_url,
  env,
  args,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: Params;
}): Promise<Response> {
  if (!args.article) {
    return {
      status: "error",
      name: "summarise_article",
      content: "Missing article",
      data: {},
    };
  }

  try {
    const provider = AIProviderFactory.getProvider("perplexity-ai");

    const data = await provider.getResponse({
      completion_id,
      app_url,
      model: "llama-3.1-sonar-large-128k-online",
      messages: [
        {
          role: "user",
          content: summariseArticlePrompt(args.article),
        },
      ],
      env: env,
    });

    const quotes = extractQuotes(data.content);
    const verifiedQuotes = verifyQuotes(args.article, quotes);

    return {
      status: "success",
      name: "summarise_article",
      content: data.content,
      data: {
        model: data.model,
        id: data.id,
        citations: data.citations,
        log_id: data.log_id,
        verifiedQuotes,
      },
    };
  } catch (error) {
    return {
      status: "error",
      name: "summarise_article",
      content:
        error instanceof Error ? error.message : "Failed to summarise article",
      data: {},
    };
  }
}
