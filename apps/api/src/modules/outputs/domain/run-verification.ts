import type {
  CouncilReviewVerdict,
  GoalEvidenceEntry,
  GoalEvidenceStatus,
  RunVerification,
  RunVerificationFinding,
  RunVerificationStatus,
} from "@ngriffin_uk/polychat-schemas";

const ESTABLISHING_EVIDENCE: readonly GoalEvidenceStatus[] = ["confirmed", "approximate"];
const RUN_CONTROL_TOOLS = new Set(["set_goal", "complete_goal", "ask_user"]);

export interface RunVerificationInput {
  ledger?: readonly GoalEvidenceEntry[];
  toolResults: readonly { name?: string | null; status?: string | null }[];
  outputCount: number;
  fileFindings: readonly RunVerificationFinding[];
  councilVerdicts?: readonly CouncilReviewVerdict[];
  checkedAt: string;
}

function finding(
  check: RunVerificationFinding["check"],
  status: RunVerificationStatus,
  detail: string,
): RunVerificationFinding {
  return { check, status, detail, outputId: null };
}

function assessEvidence(input: RunVerificationInput): RunVerificationFinding {
  const workDone = input.toolResults.some(
    (result) => result.status === "success" && !RUN_CONTROL_TOOLS.has(result.name ?? ""),
  );

  if (!workDone && input.outputCount === 0) {
    return finding(
      "evidence",
      "unverified",
      "The run recorded no successful tool results or outputs to back its result.",
    );
  }

  if (input.ledger && !input.ledger.some((entry) => ESTABLISHING_EVIDENCE.includes(entry.status))) {
    return finding(
      "evidence",
      "unverified",
      "The run did not cite confirmed evidence that the objective was met.",
    );
  }

  return finding("evidence", "verified", "The run recorded evidence for its result.");
}

function assessCouncil(verdicts: readonly CouncilReviewVerdict[]): RunVerificationFinding | null {
  if (verdicts.length === 0) {
    return null;
  }

  if (verdicts.includes("revise")) {
    return finding("council", "failed", "The council asked for changes before this can ship.");
  }

  return verdicts.includes("hold")
    ? finding("council", "unverified", "The council left this for a person to decide.")
    : finding("council", "verified", "The council found the work ready to ship.");
}

export function assessRunVerification(input: RunVerificationInput): RunVerification {
  const council = assessCouncil(input.councilVerdicts ?? []);
  const findings = [assessEvidence(input), ...input.fileFindings, ...(council ? [council] : [])];
  const statuses = findings.map((entry) => entry.status);

  return {
    status: statuses.includes("failed")
      ? "failed"
      : statuses.includes("unverified")
        ? "unverified"
        : "verified",
    findings,
    checkedAt: input.checkedAt,
  };
}

export function isRunVerified(verification: RunVerification | null): boolean {
  return verification?.status === "verified";
}
