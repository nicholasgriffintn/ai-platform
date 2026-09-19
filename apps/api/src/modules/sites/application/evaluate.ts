import { gridVariants, runExperiment } from "@ngriffin_uk/polychat-ai-experiments";
import type {
  ModelTier,
  SiteEvaluationRequest,
  SiteEvaluationResponse,
  SiteEvaluationRun,
  SiteQuality,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { runSiteGeneration, type SiteGenerationOverrides } from "./generate";

export interface EvaluateSitePromptsOptions {
  context: ServiceContext;
  user: IUser;
  request: SiteEvaluationRequest;
}

export function scoreSiteQuality(quality: SiteQuality | null, issueCount: number): number {
  if (!quality) {
    return 0;
  }

  const repairPenalty = Math.min(issueCount, 5) * 0.03;

  return Math.max(
    0,
    quality.coverage * 0.6 +
      (1 - quality.placeholders) * 0.2 +
      quality.coherent * 0.2 -
      repairPenalty,
  );
}

export async function evaluateSitePrompts({
  context,
  user,
  request,
}: EvaluateSitePromptsOptions): Promise<SiteEvaluationResponse> {
  const tiers: ModelTier[] = request.tiers ?? ["low"];
  const variants = gridVariants({
    guidance: request.guidance ?? [true],
    subset: request.subset ?? [true],
    tier: tiers,
  }).map((variant) => ({ id: variant.id, config: variant.config as SiteGenerationOverrides }));
  const runs: SiteEvaluationRun[] = [];
  const summary = await runExperiment({
    key: "sites-prompt",
    variants,
    concurrency: request.concurrency ?? 1,
    execute: async (config: SiteGenerationOverrides) => {
      const results: SiteEvaluationRun[] = [];

      for (const brief of request.briefs) {
        const startedAt = Date.now();

        try {
          const result = await runSiteGeneration({
            context,
            user,
            request: { prompt: brief, model: request.model },
            overrides: config,
            persist: false,
          });

          results.push({
            variantId: variantIdFor(config),
            brief,
            ok: true,
            durationMs: Date.now() - startedAt,
            score: scoreSiteQuality(result.quality, result.issues.length),
            quality: result.quality,
            issues: result.issues.length,
            pages: Object.keys(result.site.project.pages).length,
            model: result.plan.model ?? null,
          });
        } catch (error) {
          results.push({
            variantId: variantIdFor(config),
            brief,
            ok: false,
            durationMs: Date.now() - startedAt,
            score: 0,
            quality: null,
            issues: 0,
            pages: 0,
            model: null,
            error: getErrorMessage(error),
          });
        }
      }

      runs.push(...results);

      return results;
    },
    metric: (results) =>
      results.length ? results.reduce((sum, run) => sum + run.score, 0) / results.length : 0,
  });

  return {
    key: summary.key,
    best: summary.best ?? null,
    variants: summary.runs.map((run) => ({
      variantId: run.variantId,
      ok: run.ok,
      score: run.score ?? null,
      durationMs: run.durationMs,
      error: run.error ?? null,
    })),
    runs,
  };
}

function variantIdFor(config: SiteGenerationOverrides): string {
  return Object.entries(config)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}
