import type { CreateLeanProofProjectTaskInput } from "@ngriffin_uk/polychat-schemas";

export function fingerprintLeanProofRequest(input: CreateLeanProofProjectTaskInput): string {
  return JSON.stringify([
    input.objective,
    input.targetPaths,
    input.declarations,
    input.acceptanceCriteria,
    input.tokenBudget ?? null,
  ]);
}
