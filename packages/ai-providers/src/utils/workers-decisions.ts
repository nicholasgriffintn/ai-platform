import { decisionMediaModalities, decisionRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { DecisionRequest } from "../types/decision.js";

interface WorkersDecisionModel {
  model: string;
  selector: string;
  acceptsMedia: boolean;
}

const WORKERS_DECISION_MODELS: WorkersDecisionModel[] = [
  { model: "@cf/cloudflare/clef", selector: "clef", acceptsMedia: false },
  { model: "@cf/cloudflare/clef-flash", selector: "clef-flash", acceptsMedia: false },
  { model: "@cf/cloudflare/clef-omni", selector: "clef-omni", acceptsMedia: true },
];

export function resolveWorkersDecisionModel(model: string | undefined): WorkersDecisionModel {
  const resolved = WORKERS_DECISION_MODELS.find(
    (candidate) => candidate.model === model || candidate.selector === model,
  );

  if (!resolved) {
    throw new AssistantError("Unsupported Workers AI decision model", ErrorType.PARAMS_ERROR, 400);
  }

  return resolved;
}

export function validateWorkersDecisionRequest(
  request: DecisionRequest,
  target: WorkersDecisionModel,
): void {
  const parsed = decisionRequestSchema.safeParse({
    state: request.state,
    questions: request.questions,
    model: request.model,
    images: request.images,
    audio: request.audio,
    videos: request.videos,
  });
  const ids = parsed.success ? Object.keys(parsed.data.questions) : [];

  if (!parsed.success || ids.length > 64 || ids.some((id) => id.length > 100)) {
    throw new AssistantError(
      "Workers AI decisions require valid questions with at most 64 questions and 100-character IDs",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const modalities = decisionMediaModalities(request);

  if (modalities.length > 0 && !target.acceptsMedia) {
    throw new AssistantError(
      `${target.selector} only judges text. Use clef-omni for ${modalities.join(" or ")}.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
