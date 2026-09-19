import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildSitePlanState,
  buildSiteQualityState,
  buildSiteRefineIntentState,
  buildSiteRefineTargetQuestion,
  listSiteRefineTargets,
  resolveSitePlan,
  resolveSiteQuality,
  resolveSiteRefineIntent,
  SITE_PLAN_QUESTIONS,
  SITE_QUALITY_QUESTIONS,
  SITE_REFINE_INTENT_QUESTIONS,
  type ResolvedRefineIntent,
  type SitePlanAnswers,
  type SiteRefineIntentAnswers,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteIssue,
  SitePlan,
  SiteProject,
  SiteQuality,
  SiteTheme,
} from "@ngriffin_uk/polychat-schemas";
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

export interface ClassifyRefineOptions {
  env: IEnv;
  user: IUser;
  prompt: string;
  project: SiteProject;
  plan: SitePlan;
  completionId?: string;
}

export async function classifySiteRefinement({
  env,
  user,
  prompt,
  project,
  plan,
  completionId,
}: ClassifyRefineOptions): Promise<ResolvedRefineIntent> {
  const candidates = listSiteRefineTargets(project);
  const targetQuestion = buildSiteRefineTargetQuestion(candidates);
  let answers: SiteRefineIntentAnswers = {};

  try {
    const decision = await ai.tryDecide({
      env,
      user,
      completion_id: completionId,
      state: buildSiteRefineIntentState(prompt, project),
      questions: {
        ...SITE_REFINE_INTENT_QUESTIONS,
        ...(targetQuestion ? { target: targetQuestion } : {}),
      },
    });

    if (decision) {
      answers = decision.answers;
    }
  } catch (error) {
    logger.warn("Jev could not classify the refinement; treating it as a restructure", {
      error_message: getErrorMessage(error),
    });
  }

  return resolveSiteRefineIntent(answers, plan, candidates);
}

export interface ScoreSiteOptions {
  env: IEnv;
  user: IUser;
  brief: string;
  project: SiteProject;
  issues: SiteIssue[];
  completionId?: string;
}

export async function scoreSite({
  env,
  user,
  brief,
  project,
  issues,
  completionId,
}: ScoreSiteOptions): Promise<SiteQuality | null> {
  try {
    const decision = await ai.tryDecide({
      env,
      user,
      completion_id: completionId,
      state: buildSiteQualityState(brief, project),
      questions: SITE_QUALITY_QUESTIONS,
    });

    return decision ? resolveSiteQuality(decision.answers, issues) : null;
  } catch (error) {
    logger.warn("Jev could not score the site", { error_message: getErrorMessage(error) });

    return null;
  }
}
