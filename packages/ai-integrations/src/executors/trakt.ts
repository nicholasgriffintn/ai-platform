import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const TRAKT_API_BASE_URL = "https://api.trakt.tv";
const fetchTraktJson = createConnectorJsonClient(TRAKT_API_BASE_URL);
const TRAKT_MEDIA_TYPES = new Set(["movies", "shows"]);

function requireTraktUser(params: Record<string, unknown>): string {
  const username = getStringParam(params, "username");

  if (!username) {
    throw new AssistantError("username is required", ErrorType.PARAMS_ERROR, 400);
  }

  return encodeURIComponent(username);
}

function requireMediaType(params: Record<string, unknown>): string {
  const type = getStringParam(params, "type") ?? "movies";

  if (!TRAKT_MEDIA_TYPES.has(type)) {
    throw new AssistantError("type must be movies or shows", ErrorType.PARAMS_ERROR, 400);
  }

  return type;
}

export async function executeTraktOperation(
  clientId: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const headers = { "trakt-api-version": "2", "trakt-api-key": clientId, Authorization: "" };
  const limit = limitPositiveInteger(getNumberParam(params, "limit"), 20, 100);

  if (operation === "get_history") {
    return fetchTraktJson({
      path: `/users/${requireTraktUser(params)}/history/${requireMediaType(params)}?limit=${limit}`,
      token: clientId,
      headers,
    });
  }

  if (operation === "get_watchlist") {
    return fetchTraktJson({
      path: `/users/${requireTraktUser(params)}/watchlist/${requireMediaType(params)}?limit=${limit}`,
      token: clientId,
      headers,
    });
  }

  throw new AssistantError("Unsupported Trakt operation", ErrorType.PARAMS_ERROR, 400);
}
