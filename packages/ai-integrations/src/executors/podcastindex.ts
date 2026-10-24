import { sha1Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const PODCAST_INDEX_API_BASE_URL = "https://api.podcastindex.org/api/1.0";
const fetchPodcastIndexJson = createConnectorJsonClient(PODCAST_INDEX_API_BASE_URL);

async function podcastIndexHeaders(credential: string): Promise<Record<string, string>> {
  const [key, secret] = credential.split(":");

  if (!key || !secret) {
    throw new AssistantError(
      "Reconnect Podcast Index with its API key and secret",
      ErrorType.CONFIGURATION_ERROR,
      400,
    );
  }

  const date = String(Math.floor(Date.now() / 1000));

  return {
    Authorization: await sha1Hex(`${key}${secret}${date}`),
    "X-Auth-Date": date,
    "X-Auth-Key": key,
    "User-Agent": "Polychat",
  };
}

export async function executePodcastIndexOperation(
  credential: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const headers = await podcastIndexHeaders(credential);
  const max = String(limitPositiveInteger(getNumberParam(params, "max"), 10, 50));

  if (operation === "search_podcasts") {
    const query = getStringParam(params, "query");

    if (!query) {
      throw new AssistantError("query is required", ErrorType.PARAMS_ERROR, 400);
    }

    return fetchPodcastIndexJson({
      path: `/api/1.0/search/byterm?${new URLSearchParams({ q: query, max }).toString()}`,
      token: credential,
      headers,
    });
  }

  if (operation === "recent_episodes") {
    const feedId = getNumberParam(params, "feedId");

    if (!feedId) {
      throw new AssistantError("feedId is required", ErrorType.PARAMS_ERROR, 400);
    }

    return fetchPodcastIndexJson({
      path: `/api/1.0/episodes/byfeedid?${new URLSearchParams({ id: String(feedId), max }).toString()}`,
      token: credential,
      headers,
    });
  }

  throw new AssistantError("Unsupported Podcast Index operation", ErrorType.PARAMS_ERROR, 400);
}
