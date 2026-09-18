import { readInferenceImpact, type InferenceImpact } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export function extractImpactPayload(data: unknown): InferenceImpact | null {
  if (!isRecord(data)) {
    return null;
  }

  return readInferenceImpact(data.impact) ?? null;
}
