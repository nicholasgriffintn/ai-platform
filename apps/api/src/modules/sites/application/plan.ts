import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildSitePlanState,
  buildSiteQualityState,
  buildSiteFastRefineCandidates,
  buildSiteFastRefineQuestion,
  buildSiteFastRefineState,
  buildSiteRefineIntentState,
  buildSiteRefineTargetQuestion,
  createSiteDecisionTrace,
  describeSitePlanDecision,
  describeSiteQualityDecision,
  describeSiteRefinementDecision,
  listSiteRefineTargets,
  resolveSitePlan,
  resolveSiteQuality,
  resolveSiteFastRefineCandidate,
  resolveSiteRefineIntent,
  SITE_PLAN_QUESTIONS,
  SITE_QUALITY_QUESTIONS,
  SITE_REFINE_INTENT_QUESTIONS,
  type ResolvedRefineIntent,
  type SiteFastRefineCandidate,
  type SitePlanAnswers,
  type SiteRefineIntentAnswers,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  DecisionAnswer,
  SiteDecisionTraceEntry,
  SiteIssue,
  SiteElementTarget,
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

export interface PlannedSite {
  plan: SitePlan;
  trace: SiteDecisionTraceEntry;
}

export async function planSite({
  env,
  user,
  prompt,
  themeHint,
  completionId,
}: PlanSiteOptions): Promise<PlannedSite> {
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();
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

  const plan = resolveSitePlan({ prompt, answers, themeHint });
  const description = describeSitePlanDecision(plan);

  return {
    plan,
    trace: createSiteDecisionTrace({
      id: `${completionId ?? "site"}:plan`,
      stage: "plan",
      source: answers ? "decision" : "heuristic",
      summary: description.summary,
      effects: description.effects,
      questions: SITE_PLAN_QUESTIONS,
      answers,
      provider,
      model,
      durationMs: Date.now() - startedAt,
      createdAt,
    }),
  };
}

export interface ClassifyRefineOptions {
  env: IEnv;
  user: IUser;
  prompt: string;
  project: SiteProject;
  plan: SitePlan;
  completionId?: string;
}

export interface ClassifiedSiteRefinement {
  intent: ResolvedRefineIntent;
  trace: SiteDecisionTraceEntry;
}

export async function classifySiteRefinement({
  env,
  user,
  prompt,
  project,
  plan,
  completionId,
}: ClassifyRefineOptions): Promise<ClassifiedSiteRefinement> {
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();
  const candidates = listSiteRefineTargets(project);
  const targetQuestion = buildSiteRefineTargetQuestion(candidates);
  let answers: SiteRefineIntentAnswers = {};
  let provider: string | undefined;
  let model: string | undefined;

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
      provider = decision.provider;
      model = decision.model;
    }
  } catch (error) {
    logger.warn("Jev could not classify the refinement; treating it as a restructure", {
      error_message: getErrorMessage(error),
    });
  }

  const intent = resolveSiteRefineIntent(answers, plan, candidates);
  const description = describeSiteRefinementDecision(intent);
  const questions = {
    ...SITE_REFINE_INTENT_QUESTIONS,
    ...(targetQuestion ? { target: targetQuestion } : {}),
  };

  return {
    intent,
    trace: createSiteDecisionTrace({
      id: `${completionId ?? "site"}:refinement`,
      stage: "refinement",
      source: Object.keys(answers).length > 0 ? "decision" : "heuristic",
      summary: description.summary,
      effects: description.effects,
      questions,
      answers,
      provider,
      model,
      durationMs: Date.now() - startedAt,
      createdAt,
    }),
  };
}

export interface ClassifySelectedElementRefinementOptions {
  env: IEnv;
  user: IUser;
  prompt: string;
  project: SiteProject;
  target: SiteElementTarget;
  completionId?: string;
}

export interface ClassifiedSelectedElementRefinement {
  action: SiteFastRefineCandidate | null;
  confidence: number;
  provider: string;
  model: string;
  trace: SiteDecisionTraceEntry;
}

export async function classifySelectedElementRefinement({
  env,
  user,
  prompt,
  project,
  target,
  completionId,
}: ClassifySelectedElementRefinementOptions): Promise<ClassifiedSelectedElementRefinement | null> {
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();
  const candidates = buildSiteFastRefineCandidates(project, target);

  if (candidates.length === 0) {
    return null;
  }

  const questions = { action: buildSiteFastRefineQuestion(candidates) };

  try {
    const decision = await ai.tryDecide({
      env,
      user,
      completion_id: completionId,
      state: buildSiteFastRefineState(prompt, project, target),
      questions,
    });

    if (!decision) {
      return null;
    }

    const answer = decision.answers.action;
    const action = resolveSiteFastRefineCandidate(answer, candidates);
    const confidence = answer.confidence;

    return {
      action,
      confidence,
      provider: decision.provider,
      model: decision.model,
      trace: createSiteDecisionTrace({
        id: `${completionId ?? "site"}:refinement`,
        stage: "refinement",
        source: "decision",
        summary: action
          ? `Jev can apply this directly: ${action.summary}`
          : "The request needs the coding model",
        effects: action
          ? ["Applied one validated selected-element patch without loading a coding model"]
          : ["Preserved full refinement capability by escalating the request"],
        questions,
        answers: decision.answers,
        provider: decision.provider,
        model: decision.model,
        durationMs: Date.now() - startedAt,
        createdAt,
      }),
    };
  } catch (error) {
    logger.warn("Jev could not route the selected-element refinement; using the coding model", {
      error_message: getErrorMessage(error),
    });

    return null;
  }
}

export interface ScoreSiteOptions {
  env: IEnv;
  user: IUser;
  brief: string;
  project: SiteProject;
  issues: SiteIssue[];
  completionId?: string;
}

export interface ScoredSite {
  quality: SiteQuality | null;
  trace: SiteDecisionTraceEntry;
}

export async function scoreSite({
  env,
  user,
  brief,
  project,
  issues,
  completionId,
}: ScoreSiteOptions): Promise<ScoredSite> {
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();
  let answers: Record<string, DecisionAnswer> | undefined;
  let provider: string | undefined;
  let model: string | undefined;

  try {
    const decision = await ai.tryDecide({
      env,
      user,
      completion_id: completionId,
      state: buildSiteQualityState(brief, project),
      questions: SITE_QUALITY_QUESTIONS,
    });

    if (decision) {
      answers = decision.answers;
      provider = decision.provider;
      model = decision.model;
    }
  } catch (error) {
    logger.warn("Jev could not score the site", { error_message: getErrorMessage(error) });
  }

  const quality = answers ? resolveSiteQuality(answers, issues) : null;
  const description = describeSiteQualityDecision(quality);

  return {
    quality,
    trace: createSiteDecisionTrace({
      id: `${completionId ?? "site"}:quality`,
      stage: "quality",
      source: answers ? "decision" : "unavailable",
      summary: description.summary,
      effects: description.effects,
      questions: SITE_QUALITY_QUESTIONS,
      answers,
      provider,
      model,
      durationMs: Date.now() - startedAt,
      createdAt,
    }),
  };
}
