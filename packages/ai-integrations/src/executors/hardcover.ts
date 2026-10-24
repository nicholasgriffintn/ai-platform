import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const HARDCOVER_API_BASE_URL = "https://api.hardcover.app/v1";
const fetchHardcoverJson = createConnectorJsonClient(HARDCOVER_API_BASE_URL);
const HARDCOVER_STATUSES: Record<string, number> = {
  want_to_read: 1,
  currently_reading: 2,
  read: 3,
};

const LIST_BOOKS_QUERY = `query ListBooks($status: Int!, $limit: Int!) {
  me {
    user_books(where: { status_id: { _eq: $status } }, limit: $limit, order_by: { updated_at: desc }) {
      rating
      updated_at
      book { title slug contributions { author { name } } }
    }
  }
}`;

export async function executeHardcoverOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  if (operation !== "list_books") {
    throw new AssistantError("Unsupported Hardcover operation", ErrorType.PARAMS_ERROR, 400);
  }

  const status = HARDCOVER_STATUSES[getStringParam(params, "status") ?? "currently_reading"];

  if (!status) {
    throw new AssistantError(
      "status must be want_to_read, currently_reading or read",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return fetchHardcoverJson({
    path: "/v1/graphql",
    token,
    method: "POST",
    body: {
      query: LIST_BOOKS_QUERY,
      variables: { status, limit: limitPositiveInteger(getNumberParam(params, "limit"), 20, 50) },
    },
  });
}
