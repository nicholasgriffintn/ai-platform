import { decisionRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { DecisionRequest } from "../types/decision.js";

export const WORKERS_AI_DEFAULT_DECISION_MODEL = "@cf/cloudflare/clef-flash";

export function resolveWorkersDecisionModel(model = WORKERS_AI_DEFAULT_DECISION_MODEL) {
  switch (model) {
    case "clef":
    case "@cf/cloudflare/clef":
      return { model: "@cf/cloudflare/clef", selector: "clef" };
    case "clef-flash":
    case "@cf/cloudflare/clef-flash":
      return { model: "@cf/cloudflare/clef-flash", selector: "clef-flash" };
    default:
      throw new AssistantError(
        "Unsupported Workers AI decision model",
        ErrorType.PARAMS_ERROR,
        400,
      );
  }
}

export function validateWorkersDecisionRequest(request: DecisionRequest): void {
  const parsed = decisionRequestSchema.safeParse({
    state: request.state,
    questions: request.questions,
    model: request.model,
  });
  const ids = parsed.success ? Object.keys(parsed.data.questions) : [];

  if (!parsed.success || ids.length > 64 || ids.some((id) => id.length > 100)) {
    throw new AssistantError(
      "Workers AI decisions require valid questions with at most 64 questions and 100-character IDs",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
