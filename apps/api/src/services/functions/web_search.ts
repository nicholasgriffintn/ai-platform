import { performDeepWebSearch } from "~/services/apps/retrieval/web-search";
import type { SearchOptions } from "~/types";

import type { ApiToolDefinition } from "../../types/functions";
import { web_search as web_searchDescriptor } from "./definitions/web_search";

export const web_search: ApiToolDefinition = {
  ...web_searchDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const conversationManager = context.conversationManager;

    const { query, search_depth, include_answer, include_raw_content, include_images } = args;
    const options: SearchOptions = {
      search_depth,
      include_answer,
      include_raw_content,
      include_images,
    };

    const {
      answer,
      sources,
      similarQuestions,
      provider,
      providerWarning,
      completion_id: web_search_completion_id,
    } = await performDeepWebSearch(
      req.env,
      req.user,
      {
        query,
        options,
        completion_id,
      },
      conversationManager,
    );

    return {
      name: "web_search",
      status: "success",
      content: "Web search completed",
      data: {
        answer,
        sources,
        similarQuestions,
        provider,
        providerWarning,
        completion_id: web_search_completion_id,
      },
    };
  },
};
