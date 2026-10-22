import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  extractionResponseSchema,
  type ExtractionAnswer,
  type ExtractionAnswers,
  type ExtractionFields,
  type ExtractionResponse,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { readDecisionTokenCount } from "./decisions.js";

const logger = getLogger({ prefix: "lib/extraction/normalise" });

export function extractionAnswersMatchFields<TFields extends ExtractionFields>(
  fields: TFields,
  answers: Record<string, ExtractionAnswer>,
): answers is ExtractionAnswers<TFields> {
  const names = Object.keys(fields);

  return (
    Object.keys(answers).length === names.length &&
    names.every((name) => answers[name]?.type === fields[name]?.type)
  );
}

export function normaliseExtractionResponse(
  raw: unknown,
  provider: string,
  requestedModel: string,
  fields: ExtractionFields,
): ExtractionResponse {
  const payload = isRecord(raw) ? raw : {};
  const usage = isRecord(payload.usage) ? payload.usage : {};
  const parsed = extractionResponseSchema.safeParse({
    provider,
    model: typeof payload.model === "string" && payload.model ? payload.model : requestedModel,
    answers: payload.answers,
    truncated: payload.truncated === true,
    state_text: typeof payload.state_text === "string" ? payload.state_text : undefined,
    usage: {
      input_tokens: readDecisionTokenCount(usage.input_tokens),
      output_tokens: readDecisionTokenCount(usage.output_tokens),
    },
  });

  if (!parsed.success || !extractionAnswersMatchFields(fields, parsed.data.answers)) {
    const answers = isRecord(payload.answers) ? payload.answers : {};

    logger.error("Extraction payload did not match the contract", {
      provider,
      issues: parsed.success
        ? []
        : parsed.error.issues.slice(0, 10).map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
      fieldTypes: Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [
          name,
          { requested: field.type, returned: isRecord(answers[name]) ? answers[name].type : null },
        ]),
      ),
    });

    throw new AssistantError(
      `${provider} returned an unexpected extraction payload`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return parsed.data;
}
