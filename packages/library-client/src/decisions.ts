import type { DecisionRequest, DecisionResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

const MEDIA_DECISION_TIMEOUT_MS = 60_000;

async function postJson<T>(path: string, body: object, timeoutMs?: number): Promise<T> {
  const response = await fetchApiOrThrow(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeoutMs,
  });

  return returnFetchedData<T>(response);
}

export const decisionsService = {
  decide(request: DecisionRequest): Promise<DecisionResponse> {
    return postJson<DecisionResponse>("/decisions", request, MEDIA_DECISION_TIMEOUT_MS);
  },
};
