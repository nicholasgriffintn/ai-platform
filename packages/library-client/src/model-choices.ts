import type {
  SuggestSystemModelChoicesInput,
  SystemModelChoicesResponse,
  SystemModelSuggestionsResponse,
  UpdateSystemModelChoicesInput,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, withQuery } from "./resource.js";

export function getModelChoices(workspaceId?: string): Promise<SystemModelChoicesResponse> {
  return requestJson(withQuery("/models/choices", { workspace_id: workspaceId }), "GET");
}

export function updateModelChoices(
  input: UpdateSystemModelChoicesInput,
): Promise<SystemModelChoicesResponse> {
  return requestJson("/models/choices", "PATCH", input);
}

export function suggestModelChoices(
  input: SuggestSystemModelChoicesInput,
): Promise<SystemModelSuggestionsResponse> {
  return requestJson("/models/choices/suggestions", "POST", input);
}
