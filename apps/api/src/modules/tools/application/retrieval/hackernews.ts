import type { CompletionResult } from "@ngriffin_uk/polychat-ai-functions";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import { getAuxiliaryModelForRetrieval } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/apps/retrieval/hackernews" });

export async function retrieveHackerNewsTopStories({
  count,
  env,
  user: _user,
}: {
  count: number;
  env: IEnv;
  user?: IUser;
}) {
  try {
    if (!env.ACCOUNT_ID) {
      throw new AssistantError("Cloudflare Account ID not configured", ErrorType.PARAMS_ERROR);
    }

    if (!env.BROWSER_RENDERING_API_KEY) {
      throw new AssistantError("Browser Rendering API Key not configured", ErrorType.PARAMS_ERROR);
    }

    const baseUrl = "https://news.ycombinator.com";

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/browser-rendering/scrape`;

    const requestBody = {
      url: baseUrl,
      elements: [
        {
          selector: ".athing",
        },
      ],
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.BROWSER_RENDERING_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new AssistantError(
        `Error retrieving HackerNews stories: ${errorText}`,
        ErrorType.PROVIDER_ERROR,
      );
    }

    const responseJson = (await response.json()) as {
      status: boolean;
      result?: {
        results: {
          attributes: { name: string; value: string }[];
          height: number;
          html: string;
          left: number;
          text: string;
          top: number;
          width: number;
        }[];
        selector: string;
      }[];
    };

    if (!responseJson?.result?.[0]?.results || responseJson.result[0].results.length === 0) {
      throw new AssistantError(
        "Error retrieving HackerNews stories: No results found",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const stories: { title: string; link: string }[] = [];
    const storyElements = responseJson.result[0].results;

    const itemsToProcess = storyElements.slice(0, count);

    for (const result of itemsToProcess) {
      const html = result.html;
      const titleLinkMatch = html.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);

      if (titleLinkMatch && titleLinkMatch.length >= 3) {
        const link = titleLinkMatch[1];
        const title = titleLinkMatch[2].trim();

        const fullLink = link.startsWith("http")
          ? link
          : link.startsWith("/")
            ? `${baseUrl}${link}`
            : `${baseUrl}/${link}`;

        stories.push({ title, link: fullLink });
      }
    }

    return stories;
  } catch (error) {
    logger.error("Error retrieving HackerNews top stories", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return [];
  }
}

export async function analyseHackerNewsStories({
  character = "normal",
  stories,
  env,
  user,
}: {
  character?: string;
  stories: { title: string; link: string }[];
  env: IEnv;
  user?: IUser;
}): Promise<CompletionResult | null> {
  try {
    if (!stories || stories.length === 0) {
      return null;
    }

    let systemPrompt = "";

    if (character === "kermitthefrog") {
      systemPrompt = getPromptText("apps/hacker-news/kermitthefrog");
    } else if (character === "gordonramsay") {
      systemPrompt = getPromptText("apps/hacker-news/gordonramsay");
    } else if (character === "davidattenborough") {
      systemPrompt = getPromptText("apps/hacker-news/davidattenborough");
    } else if (character === "clippy") {
      systemPrompt = getPromptText("apps/hacker-news/clippy");
    } else {
      systemPrompt = getPromptText("apps/hacker-news/normal");
    }

    const {
      model: modelToUse,
      provider: providerToUse,
      effort,
    } = await getAuxiliaryModelForRetrieval(env, user);
    const stringifiedStories = stories
      .map(
        (story: { title: string; link: string }, index: number) => `${index + 1}. ${story.title}`,
      )
      .join("\n");

    const response = await ai.complete({
      env,
      user,
      model: modelToUse,
      provider: providerToUse,
      system: systemPrompt,
      prompt: `Analyze these top Hacker News stories and provide a brief, engaging summary:\n\n${stringifiedStories}`,
      reasoning_effort: effort,
      disable_functions: true,
    });

    if (!response.text) {
      throw new AssistantError("Failed to analyse HackerNews stories", ErrorType.PROVIDER_ERROR);
    }

    return response;
  } catch (error) {
    logger.error("Error analysing HackerNews stories", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}
