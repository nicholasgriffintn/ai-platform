import {
  getCouncilMemberPrompt,
  getPromptText,
  renderPrompt,
} from "@ngriffin_uk/polychat-ai-prompts";
import {
  COUNCIL_REVIEW_SEATS,
  councilMembers,
  type CouncilMemberDefinition,
  type CouncilReviewSeat,
} from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";

import {
  readCouncilAdjudication,
  readCouncilVote,
  type CouncilAdjudication,
} from "~/modules/outputs/domain/council-review";

import { createPanelCompletion, type PanelCompletionScope } from "./panel";

const SUBJECT_CHARS = 24_000;
const VERDICT_PROMPT = "apps/functions/council-review-verdict";

export interface CouncilReviewSubject {
  title: string;
  kind: string;
  text: string;
  priorBriefs: readonly string[];
}

export interface CouncilReviewResult extends CouncilAdjudication {
  seats: CouncilReviewSeat[];
  model: string;
}

function seatDefinitions(): CouncilMemberDefinition[] {
  return COUNCIL_REVIEW_SEATS.map((id) => {
    const member = (councilMembers as readonly CouncilMemberDefinition[]).find(
      (candidate) => candidate.id === id,
    );

    if (!member) {
      throw new Error(`Council seat ${id} is not defined`);
    }

    return member;
  });
}

function describeSubject(subject: CouncilReviewSubject): string {
  return `Work under review: ${subject.title} (${subject.kind})\n\n<work>\n${truncateForModel(subject.text, SUBJECT_CHARS)}\n</work>`;
}

export async function runCouncilReview(
  scope: PanelCompletionScope,
  subject: CouncilReviewSubject,
): Promise<CouncilReviewResult> {
  const { complete, model } = await createPanelCompletion(scope);
  const seats = seatDefinitions();
  const work = describeSubject(subject);

  const critiques = await Promise.all(
    seats.map((seat) =>
      complete(
        renderPrompt("apps/functions/council-review-critique", {
          memberName: seat.name,
          memberRole: seat.role,
          memberInstruction: getCouncilMemberPrompt(seat.id),
        }),
        work,
      ),
    ),
  );

  const rebuttals = await Promise.all(
    seats.map((seat, index) => {
      const others = seats
        .map((other, otherIndex) =>
          otherIndex === index ? null : `${other.name}: ${critiques[otherIndex]}`,
        )
        .filter((entry): entry is string => entry !== null)
        .join("\n\n");

      return complete(
        renderPrompt("apps/functions/council-review-rebuttal", {
          memberName: seat.name,
          memberRole: seat.role,
        }),
        `${work}\n\nYour critique:\n${critiques[index]}\n\nThe other seats:\n${others}`,
      );
    }),
  );

  const reviewed: CouncilReviewSeat[] = seats.map((seat, index) => {
    const { rebuttal, vote } = readCouncilVote(rebuttals[index] ?? "");

    return { memberId: seat.id, critique: critiques[index] ?? "", rebuttal, vote };
  });

  const transcript = reviewed
    .map(
      (seat) =>
        `${seat.memberId}\nCritique: ${seat.critique}\nRebuttal: ${seat.rebuttal}\nVote: ${seat.vote}`,
    )
    .join("\n\n");
  const prior = subject.priorBriefs.length
    ? `\n\nEarlier verdicts on similar work:\n${subject.priorBriefs.map((brief) => `- ${brief}`).join("\n")}`
    : "";
  const raw = await complete(getPromptText(VERDICT_PROMPT), `${work}\n\n${transcript}${prior}`);

  return { ...readCouncilAdjudication(raw, reviewed), seats: reviewed, model };
}
