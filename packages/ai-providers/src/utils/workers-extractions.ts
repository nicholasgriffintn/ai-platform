import { extractionRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ExtractionRequest } from "../types/extraction.js";

export const WORKERS_AI_DEFAULT_EXTRACTION_MODEL = "@cf/cloudflare/clairic";

interface WorkersExtractionModel {
  model: string;
  selector: string;
}

const WORKERS_EXTRACTION_MODELS: WorkersExtractionModel[] = [
  { model: "@cf/cloudflare/clairic", selector: "clairic" },
];

export function resolveWorkersExtractionModel(
  model = WORKERS_AI_DEFAULT_EXTRACTION_MODEL,
): WorkersExtractionModel {
  const resolved = WORKERS_EXTRACTION_MODELS.find(
    (candidate) => candidate.model === model || candidate.selector === model,
  );

  if (!resolved) {
    throw new AssistantError(
      "Unsupported Workers AI extraction model",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return resolved;
}

export function validateWorkersExtractionRequest(request: ExtractionRequest): void {
  const parsed = extractionRequestSchema.safeParse({
    state: request.state,
    fields: request.fields,
    images: request.images,
    reference_date: request.reference_date,
    options: request.options,
  });

  if (!parsed.success) {
    throw new AssistantError(
      "Workers AI extractions need text or up to four images and between 1 and 128 valid fields",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
