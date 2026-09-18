import type { GuardrailContent, GuardrailInput } from "../../types/index.js";

export function normaliseGuardrailInput(input: GuardrailInput): GuardrailContent {
  return typeof input === "string" ? { text: input } : input;
}
