import type { GuardrailContent, GuardrailInput } from "~/types";

export function normaliseGuardrailInput(input: GuardrailInput): GuardrailContent {
  return typeof input === "string" ? { text: input } : input;
}
