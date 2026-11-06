import {
  councilReviewVerdictSchema,
  type CouncilReviewSeat,
  type CouncilReviewVerdict,
  type GoalEvidenceEntry,
} from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

const VOTE_LINE = /^\s*VOTE:\s*(ship|revise|hold)\s*$/im;
const PREFERRED_TEXT_FIELDS = ["markdown", "text", "body", "summary", "content"] as const;
const EVIDENCE_CHARS = 6_000;

const adjudicationSchema = z.object({
  verdict: councilReviewVerdictSchema,
  brief: z.string().trim().min(1),
  dissent: z.array(z.string().trim().min(1)).default([]),
});

export interface CouncilAdjudication {
  verdict: CouncilReviewVerdict;
  brief: string;
  dissent: string[];
}

export function readCouncilVote(rebuttal: string): {
  rebuttal: string;
  vote: CouncilReviewVerdict;
} {
  const match = rebuttal.match(VOTE_LINE);
  const vote = councilReviewVerdictSchema.safeParse(match?.[1]?.toLowerCase());

  return {
    rebuttal: match ? rebuttal.replace(match[0], "").trim() : rebuttal.trim(),
    vote: vote.success ? vote.data : "hold",
  };
}

export function tallyCouncilVotes(seats: readonly Pick<CouncilReviewSeat, "vote">[]) {
  if (seats.some((seat) => seat.vote === "hold")) {
    return "hold";
  }

  return seats.some((seat) => seat.vote === "revise") ? "revise" : "ship";
}

export function readCouncilAdjudication(
  raw: string,
  seats: readonly CouncilReviewSeat[],
): CouncilAdjudication {
  const tallied = tallyCouncilVotes(seats);
  const parsed = adjudicationSchema.safeParse(parseAIResponseJson(raw).data);

  if (!parsed.success) {
    return {
      verdict: tallied,
      brief: "The adjudicator returned no usable verdict, so the seats' votes decided it.",
      dissent: [],
    };
  }

  const verdict =
    parsed.data.verdict === "ship" && tallied !== "ship" ? tallied : parsed.data.verdict;

  return { verdict, brief: parsed.data.brief, dissent: parsed.data.dissent };
}

export function councilReviewSubject(content: Record<string, unknown>): string {
  for (const field of PREFERRED_TEXT_FIELDS) {
    const value = content[field];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return JSON.stringify(content, null, 2);
}

export function councilEvidenceBlock(evidence: readonly GoalEvidenceEntry[]): string {
  if (evidence.length === 0) {
    return "";
  }

  const ledger = evidence
    .map((entry) =>
      [
        `- ${entry.claim} (${entry.status})`,
        `  How: ${entry.route}`,
        `  Where: ${entry.evidence_surface}`,
        ...(entry.remaining_uncertainty ? [`  Unproven: ${entry.remaining_uncertainty}`] : []),
      ].join("\n"),
    )
    .join("\n");

  return `\n\nEvidence the run recorded for this work:\n\n<evidence>\n${truncateForModel(ledger, EVIDENCE_CHARS)}\n</evidence>`;
}
