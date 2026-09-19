import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildSitePlanState,
  resolveSitePlan,
  SITE_PLAN_QUESTIONS,
  type SitePlanAnswers,
} from "@ngriffin_uk/polychat-library-sites";
import type { SitePlan, SiteTheme } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/sites/plan" });

export interface PlanSiteOptions {
  env: IEnv;
  user: IUser;
  prompt: string;
  themeHint?: Partial<SiteTheme>;
  completionId?: string;
}

export async function planSite({
  env,
  user,
  prompt,
  themeHint,
  completionId,
}: PlanSiteOptions): Promise<SitePlan> {
  let answers: SitePlanAnswers | undefined;
  let provider: string | undefined;
  let model: string | undefined;

  try {
    const decision = await ai.tryDecide({
      env,
      user,
      completion_id: completionId,
      state: buildSitePlanState(prompt, themeHint),
      questions: SITE_PLAN_QUESTIONS,
    });

    if (decision) {
      answers = decision.answers;
      provider = decision.provider;
      model = decision.model;
    }
  } catch (error) {
    logger.warn("Jev could not classify the site brief; using heuristics", {
      error_message: getErrorMessage(error),
    });
  }

  return resolveSitePlan({ prompt, answers, themeHint, provider, model });
}
