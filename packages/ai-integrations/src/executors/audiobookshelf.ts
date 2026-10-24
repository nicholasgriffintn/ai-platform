import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  fetchFollowingSafeRedirects,
  parsePublicHttpUrl,
} from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { getNumberParam, limitPositiveInteger } from "./params";

const OPERATION_PATHS: Record<string, string> = {
  list_in_progress: "/api/me/items-in-progress",
  list_listening_sessions: "/api/me/listening-sessions",
};
const DEFAULT_SESSIONS = 20;
const MAX_SESSIONS = 50;

function readServerCredential(credential: string): { server: URL; token: string } {
  const separator = credential.lastIndexOf("|");
  const address = separator > 0 ? credential.slice(0, separator).trim() : "";
  const token = separator > 0 ? credential.slice(separator + 1).trim() : "";

  if (!address || !token) {
    throw new AssistantError(
      "Reconnect Audiobookshelf with its server address and API token",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const server = parsePublicHttpUrl(address);

  if (server.protocol !== "https:" || server.search || server.hash) {
    throw new AssistantError(
      "The Audiobookshelf server must be a public HTTPS address",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { server, token };
}

export async function executeAudiobookshelfOperation(
  credential: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const path = OPERATION_PATHS[operation];

  if (!path) {
    throw new AssistantError("Unsupported Audiobookshelf operation", ErrorType.PARAMS_ERROR, 400);
  }

  const { server, token } = readServerCredential(credential);
  const url = new URL(`${server.pathname.replace(/\/$/, "")}${path}`, server.origin);

  if (operation === "list_listening_sessions") {
    url.searchParams.set(
      "itemsPerPage",
      String(limitPositiveInteger(getNumberParam(params, "limit"), DEFAULT_SESSIONS, MAX_SESSIONS)),
    );
  }

  const response = await fetchFollowingSafeRedirects(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new AssistantError(
      `Audiobookshelf request failed (${response.status}): ${redactSensitiveTokens(text).slice(0, 300)}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const data = safeParseJson(text);

  if (!data) {
    throw new AssistantError(
      "Audiobookshelf returned invalid JSON",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return data;
}
