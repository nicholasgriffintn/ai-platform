import type { WorkAttentionQuery, WorkAttentionResponse } from "@ngriffin_uk/polychat-schemas";

import { requestJson, withQuery } from "./resource.js";

export function listWorkAttention(query: WorkAttentionQuery): Promise<WorkAttentionResponse> {
  return requestJson<WorkAttentionResponse>(withQuery("/attention", query), "GET");
}
