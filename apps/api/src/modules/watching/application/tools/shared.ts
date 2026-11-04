import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ApiToolDefinition } from "~/types/functions";

type ToolContext = Parameters<ApiToolDefinition["execute"]>[1];

const FILM_AND_TV_CORE_TOOLS = [
  "search_titles",
  "get_title",
  "discover_titles",
  "get_shelf",
  "save_to_shelf",
  "mark_episodes",
];

const TOOLS_WITHOUT_TMDB = new Set([
  "cinema_listings",
  "get_episode_progress",
  "connect_trakt",
  "get_shelf",
  "import_from_trakt",
  "latest_trailers",
  "search_anime",
  "title_background",
]);

export function requireContext(toolContext: ToolContext): ServiceContext {
  const context = toolContext.request.context;

  if (!context) {
    throw new AssistantError(
      "Sign in to use film and TV tools",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return context;
}

export function withFilmAndTvCompanions(tools: ApiToolDefinition[]): ApiToolDefinition[] {
  return tools.map((tool) => ({
    ...tool,
    companionTools: FILM_AND_TV_CORE_TOOLS,
    ...(TOOLS_WITHOUT_TMDB.has(tool.name) ? {} : { requiredEnv: ["TMDB_API_TOKEN"] }),
  }));
}

export function describeTraktSync(outcome: string): string {
  if (outcome === "synced") {
    return " Sent to Trakt.";
  }

  return outcome === "failed" ? " It could not be sent to Trakt." : "";
}

export function success(name: string, content: string, data: Record<string, unknown>) {
  return { name, status: "success", content, data: { ...data, responseType: "text" } };
}
