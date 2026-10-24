import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const LASTFM_API_BASE_URL = "https://ws.audioscrobbler.com/2.0";
const fetchLastfmJson = createConnectorJsonClient(LASTFM_API_BASE_URL);
const LASTFM_PERIODS = new Set(["overall", "7day", "1month", "3month", "6month", "12month"]);
const LASTFM_METHODS: Record<string, string> = {
  get_recent_tracks: "user.getrecenttracks",
  get_top_artists: "user.gettopartists",
  get_top_tracks: "user.gettoptracks",
};

export const LASTFM_CREDENTIAL_SEPARATOR = "|";

function readLastfmCredential(credential: string): { apiKey: string; user?: string } {
  const separator = credential.indexOf(LASTFM_CREDENTIAL_SEPARATOR);

  if (separator === -1) {
    return { apiKey: credential };
  }

  const user = credential.slice(separator + 1).trim();

  return { apiKey: credential.slice(0, separator), ...(user ? { user } : {}) };
}

export async function executeLastfmOperation(
  credential: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const method = LASTFM_METHODS[operation];
  const stored = readLastfmCredential(credential);
  const apiKey = stored.apiKey;
  const user = getStringParam(params, "user") ?? stored.user;

  if (!method) {
    throw new AssistantError("Unsupported Last.fm operation", ErrorType.PARAMS_ERROR, 400);
  }

  if (!user) {
    throw new AssistantError("user is required", ErrorType.PARAMS_ERROR, 400);
  }

  const period = getStringParam(params, "period") ?? "1month";
  const query = new URLSearchParams({
    method,
    user,
    api_key: apiKey,
    format: "json",
    limit: String(limitPositiveInteger(getNumberParam(params, "limit"), 20, 100)),
  });

  if (operation !== "get_recent_tracks") {
    if (!LASTFM_PERIODS.has(period)) {
      throw new AssistantError("period is not a Last.fm period", ErrorType.PARAMS_ERROR, 400);
    }

    query.set("period", period);
  }

  return fetchLastfmJson({ path: `/2.0/?${query.toString()}`, token: apiKey });
}
