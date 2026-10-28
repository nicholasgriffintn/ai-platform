import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function requireRequestModel(model: string | undefined, capability: string): string {
  if (!model) {
    throw new AssistantError(`A ${capability} model is required`, ErrorType.PARAMS_ERROR);
  }

  return model;
}
