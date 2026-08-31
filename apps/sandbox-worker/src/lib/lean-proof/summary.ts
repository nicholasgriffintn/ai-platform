export const LEAN_PROOF_SUMMARY_MAX_CHARS = 10_000;

const TRUNCATION_MARKER = "\n\n… [middle omitted to fit Lean proof summary limit] …\n\n";
const HEAD_SHARE = 0.6;

export function normaliseLeanProofSummary(value: string): string {
  const summary = value.trim() || "Lean proof run completed without a model summary.";

  if (summary.length <= LEAN_PROOF_SUMMARY_MAX_CHARS) {
    return summary;
  }

  const retainedChars = LEAN_PROOF_SUMMARY_MAX_CHARS - TRUNCATION_MARKER.length;
  const headChars = Math.floor(retainedChars * HEAD_SHARE);
  const tailChars = retainedChars - headChars;

  return `${summary.slice(0, headChars)}${TRUNCATION_MARKER}${summary.slice(-tailChars)}`;
}
