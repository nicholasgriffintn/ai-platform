import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getStringParam } from "./params";

const READWISE_API_BASE_URL = "https://readwise.io/api";
const fetchReadwiseJson = createConnectorJsonClient(READWISE_API_BASE_URL);
const READER_LOCATIONS = new Set(["new", "later", "shortlist", "archive", "feed"]);

function readwiseRequest(token: string, path: string) {
  return fetchReadwiseJson({ path, token, headers: { Authorization: `Token ${token}` } });
}

export async function executeReadwiseOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const updatedAfter = getStringParam(params, "updatedAfter");
  const cursor = getStringParam(params, "pageCursor");

  if (operation === "list_highlights") {
    const query = new URLSearchParams();

    if (updatedAfter) {
      query.set("updatedAfter", updatedAfter);
    }

    if (cursor) {
      query.set("pageCursor", cursor);
    }

    return readwiseRequest(token, `/api/v2/export/?${query.toString()}`);
  }

  if (operation === "list_reader_documents") {
    const location = getStringParam(params, "location") ?? "later";

    if (!READER_LOCATIONS.has(location)) {
      throw new AssistantError("location is not a Reader location", ErrorType.PARAMS_ERROR, 400);
    }

    const query = new URLSearchParams({ location });

    if (updatedAfter) {
      query.set("updatedAfter", updatedAfter);
    }

    if (cursor) {
      query.set("pageCursor", cursor);
    }

    return readwiseRequest(token, `/api/v3/list/?${query.toString()}`);
  }

  throw new AssistantError("Unsupported Readwise operation", ErrorType.PARAMS_ERROR, 400);
}
