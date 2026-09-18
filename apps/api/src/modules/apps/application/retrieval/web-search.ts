import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";
import z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { handleWebSearch } from "~/modules/search/application/web";
import type { IEnv, IUser, SearchOptions, SearchProviderName } from "~/types";

import {
  webSearchAnswerSystemPrompt,
  webSearchSimilarQuestionsSystemPrompt,
} from "./web-search-prompts";

export interface DeepWebSearchParams {
  query: string;
  options: SearchOptions;
  completion_id?: string;
  searchProvider?: SearchProviderName;
}

export async function performDeepWebSearch(
  env: IEnv,
  user?: IUser,
  body?: DeepWebSearchParams,
  conversationManager?: ConversationManager,
) {
  const { query: rawQuery, options, completion_id, searchProvider } = body || {};

  const query = sanitiseInput(rawQuery);

  if (!query || !options) {
    throw new AssistantError("Missing query or options", ErrorType.PARAMS_ERROR);
  }

  const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env, user);

  const [webSearchResults, similarQuestions] = await Promise.all([
    handleWebSearch({
      provider: searchProvider,
      query: query,
      options: {
        search_depth: options.search_depth,
        include_answer: options.include_answer,
        include_raw_content: options.include_raw_content,
        include_images: options.include_images,
      },
      env: env,
      user: user,
    }),

    ai
      .generateObject({
        env,
        user,
        completion_id,
        model: modelToUse,
        provider: providerToUse,
        name: "similar_questions",
        schema: z.object({ questions: z.array(z.string()) }),
        system: webSearchSimilarQuestionsSystemPrompt(),
        prompt: query,
        max_tokens: 1024,
        store: false,
      })
      .then((result) => result.object.questions)
      .catch(() => []),
  ]);

  const searchData = webSearchResults.data || {};
  const rawSearchResult = searchData.result;
  const searchResults = Array.isArray(searchData.results)
    ? searchData.results
    : Array.isArray(rawSearchResult?.results)
      ? rawSearchResult.results
      : [];
  const searchAnswer = rawSearchResult?.answer as string | undefined;
  const providerUsed = searchData.provider as SearchProviderName | undefined;
  const providerWarning = searchData.warning as string | undefined;

  const sources = searchResults.map((result: any) => {
    return {
      title: result.title,
      url: result.url,
      content:
        result.content ||
        result.snippet ||
        result.excerpt ||
        result.description ||
        result.summary ||
        result.title,
      excerpts: result.excerpts || [],
      score: result.score,
      image: result.imageUrl || result.image || undefined,
      favicon: result.favicon || undefined,
      publishedDate: result.publishedDate || result.date || result.last_updated || undefined,
    };
  });

  const completion_id_with_fallback = completion_id || generateId();
  const new_completion_id = `${completion_id_with_fallback}-answer`;

  const answerContexts = sources
    .map((source: any, index: number) => {
      return `${searchAnswer ? `[[answer]] ${searchAnswer}` : ""}[[citation:${index}]] ${source.content}`;
    })
    .join("\n\n");
  const systemPrompt = webSearchAnswerSystemPrompt(answerContexts);

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "system",
      content: systemPrompt,
      timestamp: Date.now(),
      platform: "api",
      model: modelToUse,
    });

    await conversationManager.add(new_completion_id, {
      role: "user",
      content: query,
      timestamp: Date.now(),
      platform: "api",
      model: modelToUse,
    });
  }

  const answer = await ai.generateText({
    env,
    user,
    completion_id,
    model: modelToUse,
    provider: providerToUse,
    system: systemPrompt,
    prompt: query,
    max_tokens: 2048,
    store: false,
  });

  if (conversationManager) {
    await conversationManager.add(new_completion_id, {
      role: "tool",
      content: "Web search completed",
      data: {
        answer,
        sources,
        provider: providerUsed,
        providerWarning,
        name: "web_search",
        formattedName: "Web Search",
        renderer: "web_search",
      },
      name: "web_search",
      timestamp: Date.now(),
      platform: "api",
      model: modelToUse,
    });

    await conversationManager.updateConversation(new_completion_id, {
      title: `Web search for ${query}`,
    });
  }

  return {
    answer,
    similarQuestions,
    sources,
    provider: providerUsed,
    providerWarning,
    completion_id: new_completion_id,
  };
}
