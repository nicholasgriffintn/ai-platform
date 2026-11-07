import {
  POLIS_ACTIONS,
  readDecisionNoul,
  type DecisionQuestions,
  type PolisAction,
  type PolisBucket,
  type PolisBucketAnswer,
  type PolisDecisionRequest,
  type PolisDecisionResponse,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { decide } from "~/modules/decisions/application/decide";
import type { IEnv, IUser } from "~/types";

const CONCURRENT_DECISIONS = 4;

const ACTION_QUESTIONS: Record<PolisAction, string> = {
  buy_home:
    "Would `resident` seriously try to buy their own home in the next year or two, given `town` and `laws`?",
  buy_to_let:
    "Would `resident` seriously try to buy a property to rent out, given `town` and `laws`?",
  change_job: "Would `resident` go looking for a different job soon, given `town` and `laws`?",
  start_business: "Would `resident` risk starting a business soon, given `town` and `laws`?",
  have_child: "Would `resident` choose to have a child soon, given `town` and `laws`?",
  couple_up: "Would `resident` want to settle down with a partner soon?",
  retrain: "Would `resident` leave work to study or retrain, given `town` and `laws`?",
  retire_early: "Would `resident` retire earlier than they have to, given `town` and `laws`?",
  move_away:
    "Would `resident` seriously consider leaving this town for good, given `town` and `laws`?",
  protest:
    "Would `resident` join a street protest against the town council, given `town` and `laws`?",
};

const APPROVAL_QUESTION =
  "Does `resident` approve of how the town council is running things, given `town` and `laws`?";
const SUPPORT_QUESTION = "Would `resident` vote for `proposal`, thinking of their own situation?";

function questionsFor(proposal: string | undefined): DecisionQuestions {
  const questions: DecisionQuestions = {
    approval: { type: "noul", instructions: APPROVAL_QUESTION },
  };

  for (const action of POLIS_ACTIONS) {
    questions[action] = { type: "noul", instructions: ACTION_QUESTIONS[action] };
  }

  if (proposal) {
    questions.support = { type: "noul", instructions: SUPPORT_QUESTION };
  }

  return questions;
}

function stateFor(bucket: PolisBucket, laws: readonly string[], proposal: string | undefined) {
  return {
    resident: {
      age_group: bucket.age,
      wealth: bucket.wealth,
      work: bucket.employment,
      housing: bucket.tenure,
      wants_most_from_life: bucket.aspiration,
    },
    town: {
      unemployment: bucket.unemployment,
      housing_costs: bucket.housingCost,
      public_mood: bucket.mood,
    },
    laws: laws.length > 0 ? [...laws] : ["The town's usual rules apply."],
    ...(proposal ? { proposal } : {}),
  };
}

export async function decidePolisBuckets(
  env: IEnv,
  user: IUser,
  request: PolisDecisionRequest,
): Promise<PolisDecisionResponse> {
  const questions = questionsFor(request.proposal);
  const answers: PolisBucketAnswer[] = [];
  let failed = 0;
  let inputTokens = 0;
  let model: string | null = null;
  let error: string | undefined;

  await mapWithConcurrency(request.buckets, CONCURRENT_DECISIONS, async (bucket) => {
    try {
      const response = await decide({
        env,
        user,
        request: {
          state: stateFor(bucket, request.laws, request.proposal),
          questions,
          model: request.model,
        },
      });
      const inclinations = Object.fromEntries(
        POLIS_ACTIONS.map((action) => [action, readDecisionNoul(response.answers, action)]),
      ) as Record<PolisAction, number>;

      model = response.model;
      inputTokens += response.usage.input_tokens;
      answers.push({
        key: bucket.key,
        inclinations,
        approval: readDecisionNoul(response.answers, "approval"),
        ...(request.proposal ? { support: readDecisionNoul(response.answers, "support") } : {}),
      });
    } catch (caught) {
      failed += 1;
      error = getErrorMessage(caught);
    }
  });

  return { answers, failed, model, inputTokens, ...(error ? { error } : {}) };
}
