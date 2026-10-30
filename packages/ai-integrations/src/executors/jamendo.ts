import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const JAMENDO_API_BASE_URL = "https://api.jamendo.com";
const JAMENDO_PLAYLIST_URL = /jamendo\.com\/playlist\/(\d+)/u;
const fetchJamendoJson = createConnectorJsonClient(JAMENDO_API_BASE_URL);

function readPlaylistId(params: Record<string, unknown>): string {
  const playlist = getStringParam(params, "playlist");

  if (!playlist) {
    throw new AssistantError("playlist is required", ErrorType.PARAMS_ERROR, 400);
  }

  const fromUrl = JAMENDO_PLAYLIST_URL.exec(playlist)?.[1];
  const id = fromUrl ?? playlist.trim();

  if (!/^\d+$/u.test(id)) {
    throw new AssistantError(
      "playlist must be a Jamendo playlist id or playlist URL",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return id;
}

function baseQuery(clientId: string, params: Record<string, unknown>): URLSearchParams {
  return new URLSearchParams({
    client_id: clientId,
    format: "json",
    audioformat: "mp32",
    limit: String(limitPositiveInteger(getNumberParam(params, "limit"), 50, 200)),
  });
}

export async function executeJamendoOperation(
  credential: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const query = baseQuery(credential, params);

  switch (operation) {
    case "list_playlist_tracks": {
      query.set("id", readPlaylistId(params));

      return fetchJamendoJson({
        path: `/v3.0/playlists/tracks/?${query.toString()}`,
        token: credential,
      });
    }

    case "get_track": {
      const id = getStringParam(params, "id");

      if (!id) {
        throw new AssistantError("id is required", ErrorType.PARAMS_ERROR, 400);
      }

      query.set("id", id);
      query.set("include", "licenses musicinfo");

      return fetchJamendoJson({ path: `/v3.0/tracks/?${query.toString()}`, token: credential });
    }

    case "search_tracks": {
      const search = getStringParam(params, "search");

      if (!search) {
        throw new AssistantError("search is required", ErrorType.PARAMS_ERROR, 400);
      }

      query.set("fuzzytags", search);
      query.set("vocalinstrumental", getStringParam(params, "vocals") ?? "instrumental");
      query.set("speed", getStringParam(params, "speed") ?? "medium high");
      query.set("ccnd", "false");
      query.set("audiodownload_allowed", "true");
      query.set("boost", "popularity_month");
      query.set("include", "licenses musicinfo");

      return fetchJamendoJson({ path: `/v3.0/tracks/?${query.toString()}`, token: credential });
    }

    default:
      throw new AssistantError("Unsupported Jamendo operation", ErrorType.PARAMS_ERROR, 400);
  }
}
