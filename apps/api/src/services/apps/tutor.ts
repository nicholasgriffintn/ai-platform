import type { ConversationManager } from "../../lib/conversationManager";
import { tutorSystemPrompt } from "../../lib/prompts";
import { AIProviderFactory } from "../../providers/factory";
import type { ChatRole, IEnv, IUser, SearchOptions } from "../../types";
import { AssistantError } from "../../utils/errors";
import { ErrorType } from "../../utils/errors";
import { handleWebSearch } from "../search/web";

export interface TutorRequestParams {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  options: SearchOptions;
  completion_id?: string;
  store?: boolean;
}

// TODO: At the moment, this is all one shot. We should make multiple API calls on the frontend so the user isn't waiting too long for the response.
// TODO: Figure out how we can build this into the frontend via dynamic apps and tool calls.
export async function completeTutorRequest(
  env: IEnv,
  user?: IUser,
  body?: TutorRequestParams,
  conversationManager?: ConversationManager,
) {
  const {
    topic,
    level = "advanced",
    options,
    completion_id,
    store = false,
  } = body || {};

  if (!topic || !options) {
    throw new AssistantError(
      "Missing question or options",
      ErrorType.PARAMS_ERROR,
    );
  }

  const provider = AIProviderFactory.getProvider("workers-ai");

  const query = `I want to learn about ${topic}`;

  const [webSearchResults] = await Promise.all([
    // TODO: Maybe we need to scrape to get the full content or force include raw content?
    handleWebSearch({
      query,
      provider: "tavily",
      options: {
        search_depth: options.search_depth,
        include_answer: options.include_answer,
        include_raw_content: options.include_raw_content,
        include_images: options.include_images,
        max_results: 9,
      },
      env: env,
      user: user,
    }),
  ]);

  const sources = webSearchResults.data.results.map((result: any) => {
    return {
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
    };
  });

  const parsedSources = sources
    .map((source: any, index: number) => {
      return `## Webpage #${index}: \n ${source.content}`;
    })
    .join("\n\n");

  const completion_id_with_fallback =
    completion_id || Math.random().toString(36).substring(2, 7);
  const new_completion_id = `${completion_id_with_fallback}-tutor`;

  const systemPrompt = tutorSystemPrompt(parsedSources, level);

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "system" as ChatRole,
      content: systemPrompt,
      timestamp: Date.now(),
      platform: "api",
      model: "mistral-large-latest",
    });

    await conversationManager.add(new_completion_id, {
      role: "user",
      content: query,
      timestamp: Date.now(),
      platform: "api",
      model: "mistral-large-latest",
    });
  }

  const answerResponse = await provider.getResponse({
    env: env,
    completion_id: new_completion_id,
    model: "mistral-large-latest",
    messages: [
      {
        role: "system" as ChatRole,
        content: systemPrompt,
      },
      {
        role: "user" as ChatRole,
        content: query,
      },
    ],
    store: false,
  });

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "tool" as ChatRole,
      content: "Tutor request completed",
      data: {
        answer: answerResponse.response,
        sources,
        name: "tutor",
        formattedName: "Tutor",
        responseType: "custom",
      },
      name: "tutor",
      status: "success",
      timestamp: Date.now(),
      platform: "api",
      model: "mistral-large-latest",
    });

    await conversationManager.updateConversation(new_completion_id, {
      title: `Learn about ${topic}`,
    });
  }

  return {
    answer: answerResponse.response,
    sources,
    completion_id: new_completion_id,
  };
}
