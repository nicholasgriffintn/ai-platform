import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildSiteRefineUserPrompt,
  buildSiteRepairPrompt,
  catalogueSubsetId,
  componentsForSiteRefinement,
  describeSiteCatalog,
  hasSiteErrors,
  serialiseSiteProjectForPrompt,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteIssue,
  SitePatch,
  SitePlan,
  SiteProject,
  SiteQuality,
  SiteTraceEntry,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv, IUser } from "~/types";

import {
  createSiteGenerationTrace,
  runSiteGenerationPass,
  type SiteGenerationPassResult,
} from "./generation-pass";
import type { SiteGenerationModel } from "./model";

const logger = getLogger({ prefix: "services/sites/automatic-repair" });

export interface AutomaticSiteRepairResult {
  project: SiteProject | null;
  issues: SiteIssue[] | null;
  patches: SitePatch[];
  trace: SiteTraceEntry;
}

export async function attemptAutomaticSiteRepair({
  env,
  user,
  generationModel,
  project,
  plan,
  brief,
  quality,
  issues,
  completionId,
  signal,
}: {
  env: IEnv;
  user: IUser;
  generationModel: SiteGenerationModel;
  project: SiteProject;
  plan: SitePlan;
  brief: string;
  quality: SiteQuality;
  issues: SiteIssue[];
  completionId: string;
  signal?: AbortSignal;
}): Promise<AutomaticSiteRepairResult> {
  const repairId = `${completionId}:repair`;
  const startedAt = Date.now();

  try {
    const repairDocument: Record<string, unknown> = { ...structuredClone(project) };
    const repairSubset = componentsForSiteRefinement(project, plan.kind);
    const result = await runSiteGenerationPass({
      env,
      user,
      generationModel,
      system: renderPrompt("apps/sites/refine", {
        components: describeSiteCatalog(repairSubset),
        document: serialiseSiteProjectForPrompt(project),
      }),
      prompt: buildSiteRefineUserPrompt(buildSiteRepairPrompt(brief, quality, issues)),
      document: repairDocument,
      completionId: repairId,
      cacheKey: `sites-repair-${catalogueSubsetId(repairSubset)}`,
      signal,
    });
    const repaired = validateSiteProject(repairDocument);
    const applied = result.applied > 0 && !hasSiteErrors(repaired.issues);

    return {
      project: applied ? repaired.project : null,
      issues: applied ? repaired.issues : null,
      patches: applied ? result.patches : [],
      trace: createSiteGenerationTrace({
        id: repairId,
        stage: "repair",
        outcome: applied ? "applied" : "discarded",
        result,
        provider: generationModel.provider,
        model: generationModel.model,
        ...(!applied && result.applied === 0
          ? { summary: "Skipped automatic repair because it produced no valid updates" }
          : {}),
      }),
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    logger.warn("Automatic site repair failed; keeping the original site", {
      completion_id: completionId,
      error_message: getErrorMessage(error),
    });

    const result: SiteGenerationPassResult = {
      patches: [],
      applied: 0,
      rejected: 0,
      skippedLines: 0,
      durationMs: Date.now() - startedAt,
    };

    return {
      project: null,
      issues: null,
      patches: [],
      trace: createSiteGenerationTrace({
        id: repairId,
        stage: "repair",
        outcome: "discarded",
        result,
        provider: generationModel.provider,
        model: generationModel.model,
        summary: "Automatic repair was unavailable, so the original site was kept",
      }),
    };
  }
}
