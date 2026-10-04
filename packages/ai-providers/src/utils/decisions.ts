import { decisionResponseSchema, type DecisionResponse } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function readDecisionTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

export function normaliseDecisionResponse(
  raw: unknown,
  provider: string,
  requestedModel: string,
): DecisionResponse {
  const payload = isRecord(raw) ? raw : {};
  const usage = isRecord(payload.usage) ? payload.usage : {};
  const parsed = decisionResponseSchema.safeParse({
    provider,
    model: typeof payload.model === "string" && payload.model ? payload.model : requestedModel,
    answers: payload.answers,
    usage: {
      input_tokens: readDecisionTokenCount(usage.input_tokens),
      output_tokens: readDecisionTokenCount(usage.output_tokens),
    },
  });

  if (!parsed.success) {
    throw new AssistantError(
      `${provider} returned an unexpected decision payload`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return parsed.data;
}
