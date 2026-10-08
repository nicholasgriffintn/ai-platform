import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchPastConversations } from "~/modules/conversations/application/conversation-recall";
import type { ApiToolDefinition } from "~/types/functions";

import {
  SEARCH_CONVERSATIONS_TOOL_NAME,
  search_conversations as search_conversationsDescriptor,
} from "./definitions/search_conversations";
import { resolveRequestProjectId } from "./request-context";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;

export const search_conversations: ApiToolDefinition = {
  ...search_conversationsDescriptor,
  execute: async (args, context) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";

    if (!query) {
      return {
        status: "error",
        name: SEARCH_CONVERSATIONS_TOOL_NAME,
        content: "Give some keywords to search earlier conversations for.",
      };
    }

    const limit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.min(Math.floor(args.limit), MAX_LIMIT))
        : DEFAULT_LIMIT;
    const matches = await searchPastConversations(resolveServiceContext(context.request), {
      query,
      projectId: resolveRequestProjectId(context.request),
      excludeConversationId: context.completionId,
      limit,
    });

    if (matches.length === 0) {
      return {
        status: "success",
        name: SEARCH_CONVERSATIONS_TOOL_NAME,
        content: `No earlier conversations mention "${query}".`,
        data: { query, matches: [] },
      };
    }

    return {
      status: "success",
      name: SEARCH_CONVERSATIONS_TOOL_NAME,
      content: matches
        .map(
          (match) =>
            `- "${match.title}" (${match.date}, ${match.role === "user" ? "the user" : "you"} said): ${match.excerpt}`,
        )
        .join("\n"),
      data: { query, matches },
    };
  },
};
