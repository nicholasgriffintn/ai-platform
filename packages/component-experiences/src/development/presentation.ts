import type { LeanProofOutcome, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

export type LeanProofTone = "success" | "info" | "warning" | "danger" | "neutral";

export interface LeanProofOutcomePresentation {
  label: string;
  description: string;
  tone: LeanProofTone;
}

const OUTCOMES: Record<LeanProofOutcome, LeanProofOutcomePresentation> = {
  kernel_checked: {
    label: "Kernel checked",
    description: "The requested declarations passed the Lean kernel and source-policy checks.",
    tone: "success",
  },
  compiled: {
    label: "Compiled",
    description: "The target builds, but declaration-level kernel evidence is not available.",
    tone: "info",
  },
  incomplete: {
    label: "Incomplete",
    description: "The run made progress, but the requested proof is not complete.",
    tone: "warning",
  },
  failed: {
    label: "Failed",
    description: "The run stopped without a compiling proof.",
    tone: "danger",
  },
};

export function getLeanProofOutcomePresentation(
  outcome: LeanProofOutcome,
): LeanProofOutcomePresentation {
  return OUTCOMES[outcome];
}

export function getLeanProofTaskStatusLabel(status: ProjectTaskStatus): string {
  switch (status) {
    case "backlog":
      return "Ready";
    case "queued":
      return "Queued";
    case "running":
      return "Proving";
    case "blocked":
      return "Needs attention";
    case "review":
      return "Ready for review";
    case "done":
      return "Approved";
    case "cancelled":
      return "Cancelled";
  }

  return "Unknown";
}

export function splitLeanProofLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
