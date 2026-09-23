import { choice } from "@ngriffin_uk/polychat-ai-functions";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DECISION_CHOICE_MAX_OPTIONS,
  type CapabilityDiscoveryItem,
  type DecisionEntry,
} from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/infrastructure/ai";
import type { CapabilityRelevance } from "~/modules/assistant-capabilities/application/discovery";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/assistant-capabilities/semantic-ranking" });

const NONE_OPTION = "__none__";
const BATCH_SIZE = DECISION_CHOICE_MAX_OPTIONS - 1;

function describeItem(item: CapabilityDiscoveryItem): DecisionEntry {
  return {
    name: item.name,
    kind: item.kind,
    description: item.description ?? null,
    tags: item.tags,
  };
}

function batchQuestions(items: readonly CapabilityDiscoveryItem[]) {
  const questions: Record<string, ReturnType<typeof choice>> = {};

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);

    questions[`batch_${start / BATCH_SIZE}`] = choice(
      "Which capability best serves the `request`? Pick the one whose purpose matches what the person is trying to do, not just shared words.",
      {
        ...Object.fromEntries(batch.map((item) => [item.id, describeItem(item)])),
        [NONE_OPTION]: "None of these capabilities would help with the request",
      },
    );
  }

  return questions;
}

export async function rankCapabilitiesSemantically(params: {
  env: IEnv;
  user?: IUser;
  query: string;
  items: readonly CapabilityDiscoveryItem[];
  completionId?: string;
}): Promise<CapabilityRelevance | undefined> {
  const query = params.query.trim();

  if (!query || params.items.length === 0) {
    return undefined;
  }

  try {
    const decided = await ai.tryDecide({
      env: params.env,
      user: params.user,
      completion_id: params.completionId,
      state: { request: query },
      questions: batchQuestions(params.items),
    });

    if (!decided) {
      return undefined;
    }

    const relevance = new Map<string, number>();

    for (const answer of Object.values(decided.answers)) {
      if (answer.type !== "choice") {
        continue;
      }

      for (const [id, probability] of Object.entries(answer.probabilities)) {
        if (id !== NONE_OPTION && probability > 0) {
          relevance.set(id, Math.max(relevance.get(id) ?? 0, probability));
        }
      }
    }

    return relevance;
  } catch (error) {
    logger.warn("Semantic capability ranking failed; using keyword scores only", { error });

    return undefined;
  }
}
