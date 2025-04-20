import type { ConversationManager } from "~/lib/conversationManager";
import {
  webSearchAnswerSystemPrompt,
  webSearchSimilarQuestionsSystemPrompt,
} from "~/lib/prompts";
import { AIProviderFactory } from "~/providers/factory";
import { handleWebSearch } from "~/services/search/web";
import type { IEnv, IUser, SearchOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface DeepWebSearchParams {
  query: string;
  options: SearchOptions;
  completion_id?: string;
}

// TODO: At the moment, this is all one shot. We should make multiple API calls on the frontend so the user isn't waiting too long for the response.
// TODO: Figure out how we can build this into the frontend via dynamic apps and tool calls.
export async function performDeepWebSearch(
  env: IEnv,
  user?: IUser,
  body?: DeepWebSearchParams,
  conversationManager?: ConversationManager,
) {
  const { query, options, completion_id } = body || {};

  if (!query || !options) {
    throw new AssistantError(
      "Missing query or options",
      ErrorType.PARAMS_ERROR,
    );
  }

  const provider = AIProviderFactory.getProvider("workers-ai");

  const [webSearchResults, similarQuestionsResponse] = await Promise.all([
    // TODO: Maybe we need to scrape to get the full content or force include raw content?
    handleWebSearch({
      query: query,
      provider: "tavily",
      options: {
        search_depth: options.search_depth,
        include_answer: options.include_answer,
        include_raw_content: options.include_raw_content,
        include_images: options.include_images,
      },
      env: env,
      user: user,
    }),

    (async () => {
      return provider.getResponse({
        env: env,
        completion_id,
        model: "@hf/nousresearch/hermes-2-pro-mistral-7b",
        messages: [
          {
            role: "system",
            content: webSearchSimilarQuestionsSystemPrompt(),
          },
          {
            role: "user",
            content: query,
          },
        ],
        store: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "similar_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });
    })(),
  ]);

  const sources = webSearchResults.data.results.map((result: any) => {
    return {
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
    };
  });

  const completion_id_with_fallback = completion_id || generateId();
  const new_completion_id = `${completion_id_with_fallback}-tutor`;

  const answerContexts = sources
    .map((source: any, index: number) => {
      return `[[citation:${index}]] ${source.content}`;
    })
    .join("\n\n");
  const systemPrompt = webSearchAnswerSystemPrompt(answerContexts);

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "system",
      content: systemPrompt,
      timestamp: Date.now(),
      platform: "api",
      model: "@cf/google/gemma-3-12b-it",
    });

    await conversationManager.add(new_completion_id, {
      role: "user",
      content: query,
      timestamp: Date.now(),
      platform: "api",
      model: "@cf/google/gemma-3-12b-it",
    });
  }

  const answerResponse = await provider.getResponse({
    env: env,
    completion_id,
    model: "@cf/google/gemma-3-12b-it",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: query,
      },
    ],
    store: false,
  });

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "tool",
      content: "Web search completed",
      data: {
        answer: answerResponse.response,
        sources,
        name: "web_search",
        formattedName: "Web Search",
        responseType: "custom",
      },
      name: "web_search",
      timestamp: Date.now(),
      platform: "api",
      model: "@cf/google/gemma-3-12b-it",
    });

    await conversationManager.updateConversation(new_completion_id, {
      title: `Web search for ${query}`,
    });
  }

  return {
    answer: answerResponse.response,
    similarQuestions: similarQuestionsResponse.response.questions,
    sources,
    completion_id: new_completion_id,
  };
}
