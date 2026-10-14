import { noul } from "@ngriffin_uk/polychat-ai-functions";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DecisionQuestions } from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/apps/retrieval/query-expansion" });

export const MAX_EXPANSION_QUERIES = 2;
const MAX_CANDIDATES = 8;
const MAX_QUERY_CHARS = 400;
const WORTH_SEARCHING_THRESHOLD = 0.7;

function candidateId(index: number): string {
  return `candidate_${index}`;
}

export function buildExpansionQuestions(candidates: readonly string[]): DecisionQuestions {
  return Object.fromEntries(
    candidates.map((candidate, index) => [
      candidateId(index),
      noul(
        {
          question:
            "Would searching this follow-up query surface evidence that searching `originalQuery` alone would miss?",
          followUpQuery: truncateForModel(redactSensitiveTokens(candidate), MAX_QUERY_CHARS),
        },
        {
          true: "It targets a distinct aspect, source or phrasing that the original query would not reach",
          false:
            "It restates the original query, narrows it trivially, or drifts away from what was asked",
        },
      ),
    ]),
  );
}

export function selectExpansionQueries(
  candidates: readonly string[],
  answers: Record<string, { type: string; noul?: number }>,
): string[] {
  return candidates
    .map((query, index) => ({ query, answer: answers[candidateId(index)] }))
    .filter(
      ({ answer }) => answer?.type === "noul" && (answer.noul ?? 0) >= WORTH_SEARCHING_THRESHOLD,
    )
    .sort((left, right) => (right.answer?.noul ?? 0) - (left.answer?.noul ?? 0))
    .slice(0, MAX_EXPANSION_QUERIES)
    .map(({ query }) => query);
}

export function normaliseCandidates(
  candidates: readonly string[],
  originalQuery: string,
): string[] {
  const seen = new Set([originalQuery.trim().toLocaleLowerCase()]);

  return candidates
    .map((candidate) => candidate.trim())
    .filter((candidate) => {
      const key = candidate.toLocaleLowerCase();

      if (!candidate || candidate.length > MAX_QUERY_CHARS || seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .slice(0, MAX_CANDIDATES);
}

export async function planExpansionQueries(params: {
  env: IEnv;
  user?: IUser;
  completionId?: string;
  query: string;
  candidates: readonly string[];
}): Promise<string[]> {
  const candidates = normaliseCandidates(params.candidates, params.query);

  if (candidates.length === 0) {
    return [];
  }

  try {
    const decision = await ai.tryDecide({
      env: params.env,
      user: params.user,
      completion_id: params.completionId,
      state: {
        originalQuery: truncateForModel(redactSensitiveTokens(params.query), MAX_QUERY_CHARS),
      },
      questions: buildExpansionQuestions(candidates),
    });

    if (!decision) {
      return [];
    }

    const selected = selectExpansionQueries(candidates, decision.answers);

    logger.info("Planned additional web searches", {
      completion_id: params.completionId,
      considered: candidates.length,
      selected: selected.length,
    });

    return selected;
  } catch (error) {
    logger.warn("Query expansion planning failed; searching the original query only", { error });

    return [];
  }
}
