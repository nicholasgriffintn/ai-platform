import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ComparisonAnswer, ComparisonResult } from "@ngriffin_uk/polychat-schemas";

import { readComparisonConclusion } from "~/modules/decisions/domain/comparison";

import { createPanelCompletion, type PanelCompletionScope, type PanelMember } from "./panel";

const logger = getLogger({ prefix: "services/chat/comparison" });

const CONCLUSION_BRIEF = "apps/functions/comparison-conclusion";

export interface ComparisonRequest {
  question: string;
  context?: string;
  original: Pick<ComparisonAnswer, "name" | "model" | "content">;
  members: readonly PanelMember[];
}

function describeQuestion(request: Pick<ComparisonRequest, "question" | "context">): string {
  const context = request.context ? `<conversation>\n${request.context}\n</conversation>\n\n` : "";

  return `${context}<question>\n${request.question}\n</question>`;
}

function describeAnswers(question: string, answers: readonly ComparisonAnswer[]): string {
  const labelled = answers
    .map((answer) => `<answer model="${answer.name}">\n${answer.content}\n</answer>`)
    .join("\n\n");

  return `${question}\n\n${labelled}`;
}

export async function runComparison(
  scope: PanelCompletionScope,
  request: ComparisonRequest,
): Promise<ComparisonResult> {
  const { complete, readSpend } = await createPanelCompletion(scope);
  const question = describeQuestion(request);
  const settled = await Promise.allSettled(
    request.members.map((member) => complete(member.instruction, question, member)),
  );
  const independent = settled.flatMap((outcome, index): ComparisonAnswer[] => {
    const member = request.members[index];

    if (outcome.status === "rejected") {
      logger.warn("A model did not answer the comparison", {
        error: outcome.reason,
        model: member.model,
      });

      return [];
    }

    return [{ name: member.name, model: member.model, content: outcome.value, isOriginal: false }];
  });

  if (independent.length === 0) {
    const failure = settled.find((outcome) => outcome.status === "rejected");

    throw failure?.reason;
  }

  const answers: ComparisonAnswer[] = [{ ...request.original, isOriginal: true }, ...independent];
  const conclusion = await complete(
    getPromptText(CONCLUSION_BRIEF),
    describeAnswers(question, answers),
  );

  return { ...readComparisonConclusion(conclusion), answers, spend: readSpend() };
}
