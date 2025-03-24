import { generateArticleReportPrompt } from "../../../lib/prompts";
import { AIProviderFactory } from "../../../providers/factory";
import type { ChatRole, IEnv } from "../../../types";
import { extractQuotes } from "../../../utils/extract";
import { verifyQuotes } from "../../../utils/verify";

export interface Params {
  articles: string;
}

export interface Response {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function generateArticlesReport({
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
  if (!args.articles) {
    return {
      status: "error",
      name: "articles_report",
      content: "Missing articles",
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
          role: "user" as ChatRole,
          content: generateArticleReportPrompt(args.articles),
        },
      ],
      env: env,
    });

    const quotes = extractQuotes(data.content);
    const verifiedQuotes = verifyQuotes(args.articles, quotes);

    return {
      status: "success",
      name: "articles_report",
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
      name: "articles_report",
      content:
        error instanceof Error ? error.message : "Failed to generate report",
      data: {},
    };
  }
}
