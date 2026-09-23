import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildSiteExampleStream,
  buildSiteGenerateUserPrompt,
  buildSitePlanGuidance,
  buildSiteRefineUserPrompt,
  catalogueSubsetId,
  collectSiteElementRefinementContext,
  componentsForSiteKind,
  componentsForSiteRefinement,
  describeSiteCatalog,
  describeSiteOutline,
  elementPatchPath,
  hasRenderableSiteContent,
  hasSiteErrors,
  serialiseSiteProjectForPrompt,
  SITE_COMPONENT_TYPES,
  validateSiteProject,
  type ResolvedRefineIntent,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  ModelTier,
  SiteDecisionTraceEntry,
  SiteElementTarget,
  SiteGenerateRequest,
  SiteIssue,
  SitePlan,
  SiteQuality,
  SiteRecord,
  SiteStreamEvent,
  SiteTraceEntry,
  SiteTurn,
} from "@ngriffin_uk/polychat-schemas";
import { decisionConfidenceBand } from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
} from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { sseResponse } from "~/infrastructure/http/streaming";
import type { IUser } from "~/types";

import { attemptAutomaticSiteRepair } from "./automatic-repair";
import { applySelectedElementFastRefinement } from "./fast-refinement";
import { createSiteGenerationTrace, runSiteGenerationPass } from "./generation-pass";
import { loadSiteGenerationModels, resolveSiteGenerationModel } from "./model";
import { createSiteGenerationPerformance } from "./performance";
import {
  classifySelectedElementRefinement,
  classifySiteRefinement,
  planSite,
  scoreSite,
  type ClassifiedSelectedElementRefinement,
} from "./plan";
import { createSite, finaliseSiteGeneration, getSite, updateSite } from "./records";

const logger = getLogger({ prefix: "services/sites/generate" });

export interface SiteGenerationOverrides {
  guidance?: boolean;
  subset?: boolean;
  tier?: ModelTier;
}

export interface StreamSiteGenerationOptions {
  context: ServiceContext;
  user: IUser;
  request: SiteGenerateRequest;
  signal?: AbortSignal;
  overrides?: SiteGenerationOverrides;
}

interface PreparedGeneration {
  plan: SitePlan;
  tier: ModelTier;
  existing: SiteRecord | null;
  system: string;
  prompt: string;
  document: Record<string, unknown>;
  cacheKey: string;
  intent: ResolvedRefineIntent | null;
  target: SiteElementTarget | null;
  selectedRefinement: ClassifiedSelectedElementRefinement | null;
  decisionTrace: SiteDecisionTraceEntry[];
}

function buildInitialDocument(request: SiteGenerateRequest, plan: SitePlan) {
  return {
    title: request.prompt.slice(0, 60).trim(),
    theme: plan.theme,
    capabilities: plan.capabilities,
    pages: {},
  };
}

async function prepareGeneration(
  options: StreamSiteGenerationOptions,
  completionId: string,
): Promise<PreparedGeneration> {
  const { context, user, request } = options;

  if (request.siteId) {
    const existing = await getSite(
      { context, userId: user.id, projectId: request.projectId },
      request.siteId,
    );

    if (
      request.target &&
      !existing.project.pages[request.target.pageId]?.elements[request.target.elementKey]
    ) {
      throw new AssistantError("The selected element no longer exists", ErrorType.NOT_FOUND, 404);
    }

    const selectedRefinement = request.target
      ? await classifySelectedElementRefinement({
          env: context.env,
          user,
          prompt: request.prompt,
          project: existing.project,
          target: request.target,
          completionId,
        })
      : null;
    const classification = request.target
      ? null
      : await classifySiteRefinement({
          env: context.env,
          user,
          prompt: request.prompt,
          project: existing.project,
          plan: existing.plan,
          completionId,
        });
    const intent = classification?.intent ?? null;
    const target = request.target ?? intent?.target ?? null;
    const targetPage = target ? existing.project.pages[target.pageId] : undefined;
    const subset = componentsForSiteRefinement(existing.project, existing.plan.kind);
    const components = describeSiteCatalog(subset);

    return {
      plan: existing.plan,
      tier: intent?.tier ?? existing.plan.tier,
      existing,
      intent,
      target,
      selectedRefinement,
      decisionTrace: [classification?.trace, selectedRefinement?.trace].filter(
        (entry): entry is SiteDecisionTraceEntry => Boolean(entry),
      ),
      system:
        target && targetPage
          ? renderPrompt("apps/sites/refine-element", {
              components,
              pageId: target.pageId,
              targetPath: elementPatchPath(target.pageId, target.elementKey),
              outline: describeSiteOutline(existing.project),
              elementContext: JSON.stringify(
                collectSiteElementRefinementContext(targetPage, target.elementKey),
              ),
            })
          : renderPrompt("apps/sites/refine", {
              components,
              document: serialiseSiteProjectForPrompt(existing.project),
            }),
      prompt: buildSiteRefineUserPrompt(request.prompt),
      document: structuredClone(existing.project) as unknown as Record<string, unknown>,
      cacheKey: `sites-refine-${target ? "element" : "site"}-${catalogueSubsetId(subset)}`,
    };
  }

  const planned = await planSite({
    env: context.env,
    user,
    prompt: request.prompt,
    themeHint: request.theme,
    completionId,
  });
  const plan = planned.plan;

  const overrides = options.overrides ?? {};
  const subset =
    overrides.subset === false ? SITE_COMPONENT_TYPES : componentsForSiteKind(plan.kind);

  return {
    plan,
    tier: overrides.tier ?? plan.tier,
    existing: null,
    intent: null,
    target: null,
    selectedRefinement: null,
    decisionTrace: [planned.trace],
    system: renderPrompt("apps/sites/generate", {
      example: buildSiteExampleStream(subset),
      components: describeSiteCatalog(subset),
      guidance: overrides.guidance === false ? "" : buildSitePlanGuidance(plan),
    }),
    prompt: buildSiteGenerateUserPrompt(request.prompt),
    document: buildInitialDocument(request, plan),
    cacheKey: `sites-generate-${catalogueSubsetId(subset)}`,
  };
}

export interface RunSiteGenerationOptions extends StreamSiteGenerationOptions {
  emit?: (event: SiteStreamEvent) => void;
  persist?: boolean;
  skipQuality?: boolean;
}

export interface SiteGenerationResult {
  site: SiteRecord;
  plan: SitePlan;
  issues: SiteIssue[];
  quality: SiteQuality | null;
}

function buildGenerationTurn({
  completionId,
  request,
  plan,
  prepared,
  provider,
  model,
  trace,
}: {
  completionId: string;
  request: SiteGenerateRequest;
  plan: SitePlan;
  prepared: PreparedGeneration;
  provider: string;
  model: string;
  trace: SiteTraceEntry[];
}): SiteTurn {
  return {
    id: completionId,
    role: "user",
    prompt: request.prompt,
    createdAt: new Date().toISOString(),
    plan,
    ...(prepared.intent ? { intent: prepared.intent.intent } : {}),
    ...(prepared.target ? { target: prepared.target } : {}),
    provider,
    model,
    trace,
  };
}

async function reviewGeneratedSite({
  options,
  completionId,
  generationModel,
  plan,
  brief,
  initialProject,
  initialIssues,
}: {
  options: RunSiteGenerationOptions;
  completionId: string;
  generationModel: Awaited<ReturnType<typeof resolveSiteGenerationModel>>;
  plan: SitePlan;
  brief: string;
  initialProject: SiteRecord["project"];
  initialIssues: SiteIssue[];
}): Promise<{
  project: SiteRecord["project"];
  issues: SiteIssue[];
  quality: SiteQuality | null;
  trace: SiteTraceEntry[];
}> {
  const emit = options.emit ?? (() => {});
  let project = initialProject;
  let issues = initialIssues;
  let quality: SiteQuality | null = null;
  const trace: SiteTraceEntry[] = [];

  if (options.skipQuality) {
    return { project, issues, quality, trace };
  }

  emit({ type: "phase", phase: "reviewing" });
  const scored = await scoreSite({
    env: options.context.env,
    user: options.user,
    brief,
    project,
    issues,
    completionId,
  });

  quality = scored.quality;
  trace.push(scored.trace);
  emit({ type: "trace", entry: scored.trace });

  if (quality?.needsRepair && decisionConfidenceBand(quality.repairConfidence ?? 0) === "high") {
    emit({ type: "phase", phase: "repairing" });
    const repair = await attemptAutomaticSiteRepair({
      env: options.context.env,
      user: options.user,
      generationModel,
      project,
      plan,
      brief,
      quality,
      issues,
      completionId,
      signal: options.signal,
    });

    trace.push(repair.trace);
    emit({ type: "trace", entry: repair.trace });

    if (repair.project && repair.issues) {
      project = repair.project;
      issues = repair.issues;

      for (const patch of repair.patches) {
        emit({ type: "patch", patch });
      }

      emit({ type: "phase", phase: "reviewing" });
      const rescored = await scoreSite({
        env: options.context.env,
        user: options.user,
        brief,
        project,
        issues,
        completionId: `${completionId}:post-repair`,
      });

      quality = rescored.quality;
      trace.push(rescored.trace);
      emit({ type: "trace", entry: rescored.trace });
    }
  }

  return { project, issues, quality, trace };
}

export async function runSiteGeneration(
  options: RunSiteGenerationOptions,
): Promise<SiteGenerationResult> {
  const { context, user, request, signal } = options;
  const emit = options.emit ?? (() => {});
  const completionId = `site-${generateId()}`;
  const performance = createSiteGenerationPerformance({
    context,
    user,
    completionId,
    refining: Boolean(request.siteId),
  });
  const loadAvailableModels = () =>
    loadSiteGenerationModels({
      env: context.env,
      user,
      requestedModel: request.model,
    }).then(
      (availableModels) => ({ availableModels, error: null }),
      (error: unknown) => ({ availableModels: null, error }),
    );
  const availableModelsPromise = request.siteId && request.target ? null : loadAvailableModels();

  emit({ type: "phase", phase: "planning" });

  try {
    const prepared = await prepareGeneration(options, completionId);
    let plan: SitePlan =
      prepared.tier === prepared.plan.tier
        ? prepared.plan
        : { ...prepared.plan, tier: prepared.tier };

    performance.mark("planCompleted");

    for (const entry of prepared.decisionTrace) {
      emit({ type: "trace", entry });
    }

    emit({ type: "plan", plan });

    if (prepared.selectedRefinement?.action && prepared.existing && prepared.target) {
      const site = await applySelectedElementFastRefinement({
        context,
        user,
        projectId: request.projectId,
        existing: prepared.existing,
        plan,
        prompt: request.prompt,
        target: prepared.target,
        completionId,
        refinement: prepared.selectedRefinement,
        emit,
      });

      if (site) {
        performance.mark("modelSelected");
        performance.mark("firstPatch");
        performance.mark("buildCompleted");
        performance.mark("finalSaved");
        performance.finish("success");

        return { site, plan, issues: site.issues, quality: null };
      }
    }

    if (prepared.intent) {
      emit({
        type: "intent",
        intent: prepared.intent.intent,
        tier: prepared.tier,
        target: prepared.target,
        confidence: prepared.intent.confidence,
      });
    }

    emit({ type: "phase", phase: "selecting" });
    const loadedModels = await (availableModelsPromise ?? loadAvailableModels());

    if (loadedModels.error) {
      throw loadedModels.error;
    }

    const generationModel = await resolveSiteGenerationModel({
      env: context.env,
      user,
      tier: prepared.tier,
      requestedModel: request.model,
      availableModels: loadedModels.availableModels,
    });

    plan = {
      ...plan,
      provider: generationModel.provider,
      model: generationModel.model,
    };

    performance.mark("modelSelected");
    emit({ type: "model", provider: generationModel.provider, model: generationModel.model });
    emit({ type: "phase", phase: "starting" });

    let renderableRecorded = false;
    let visibleOutputStarted = false;
    const buildResult = await runSiteGenerationPass({
      env: context.env,
      user,
      generationModel,
      system: prepared.system,
      prompt: prepared.prompt,
      document: prepared.document,
      completionId,
      cacheKey: prepared.cacheKey,
      signal,
      onProviderStreamOpened: () => performance.mark("providerStreamOpened"),
      onReasoning: () => {
        if (!visibleOutputStarted) {
          emit({ type: "phase", phase: "reasoning" });
        }
      },
      onFirstToken: () => {
        visibleOutputStarted = true;
        performance.mark("firstToken");
        emit({ type: "phase", phase: "streaming" });
      },
      onPatch: (patch) => {
        performance.mark("firstPatch");
        emit({ type: "patch", patch });

        if (
          !renderableRecorded &&
          hasRenderableSiteContent(validateSiteProject(prepared.document).project)
        ) {
          renderableRecorded = true;
          performance.mark("firstRenderable");
        }
      },
    });

    performance.mark("buildCompleted");
    const buildTrace = createSiteGenerationTrace({
      id: `${completionId}:build`,
      stage: "build",
      outcome: buildResult.applied > 0 ? "applied" : "discarded",
      result: buildResult,
      provider: generationModel.provider,
      model: generationModel.model,
    });
    const initialTrace: SiteTraceEntry[] = [...prepared.decisionTrace, buildTrace];

    emit({ type: "trace", entry: buildTrace });

    const initial = validateSiteProject(prepared.document);

    logger.info("Site generation finished", {
      completion_id: completionId,
      applied: buildResult.applied,
      rejected: buildResult.rejected,
      skipped_lines: buildResult.skippedLines,
      issues: initial.issues.length,
      pages: Object.keys(initial.project.pages).length,
    });

    if (hasSiteErrors(initial.issues)) {
      throw new AssistantError(
        initial.issues.find((issue) => issue.severity === "error")?.message ?? "Generation failed",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const brief = prepared.existing?.brief ?? request.prompt;
    const scope = { context, userId: user.id, projectId: request.projectId };
    const initialTurn = buildGenerationTurn({
      completionId,
      request,
      plan,
      prepared,
      provider: generationModel.provider,
      model: generationModel.model,
      trace: initialTrace,
    });
    let initialSite: SiteRecord | null = null;

    if (options.persist !== false) {
      emit({ type: "phase", phase: "saving" });
      initialSite = prepared.existing
        ? await updateSite(scope, prepared.existing.id, {
            brief,
            plan,
            project: initial.project,
            issues: initial.issues,
            quality: null,
            turn: initialTurn,
          })
        : await createSite(scope, {
            brief,
            plan,
            project: initial.project,
            issues: initial.issues,
            quality: null,
            turn: initialTurn,
          });

      performance.mark("initialSaved");
      emit({ type: "saved", stage: options.skipQuality ? "final" : "initial", site: initialSite });
    }

    const reviewed = await reviewGeneratedSite({
      options,
      completionId,
      generationModel,
      plan,
      brief,
      initialProject: initial.project,
      initialIssues: initial.issues,
    });

    performance.mark("reviewCompleted");
    const finalTurn = buildGenerationTurn({
      completionId,
      request,
      plan,
      prepared,
      provider: generationModel.provider,
      model: generationModel.model,
      trace: [...initialTrace, ...reviewed.trace],
    });
    let site: SiteRecord;

    if (options.persist === false) {
      site = {
        id: completionId,
        title: reviewed.project.title,
        brief,
        projectId: request.projectId ?? null,
        revision: 0,
        plan,
        project: reviewed.project,
        issues: reviewed.issues,
        quality: reviewed.quality,
        turns: [finalTurn],
        createdAt: finalTurn.createdAt,
        updatedAt: null,
      };
      emit({ type: "saved", stage: "final", site });
    } else if (options.skipQuality && initialSite) {
      site = initialSite;
    } else if (initialSite) {
      emit({ type: "phase", phase: "saving" });
      site = await finaliseSiteGeneration(scope, initialSite.id, initialSite.revision, {
        brief,
        plan,
        project: reviewed.project,
        issues: reviewed.issues,
        quality: reviewed.quality,
        turn: finalTurn,
      });
      emit({ type: "saved", stage: "final", site });
    } else {
      throw new AssistantError("The generated site was not saved", ErrorType.STORAGE_ERROR);
    }

    performance.mark("finalSaved");
    emit({ type: "done", issues: reviewed.issues, quality: reviewed.quality });
    performance.finish("success");

    return {
      site,
      plan,
      issues: reviewed.issues,
      quality: reviewed.quality,
    };
  } catch (error) {
    performance.finish("error", error);
    throw error;
  }
}

export async function streamSiteGeneration(
  options: StreamSiteGenerationOptions,
): Promise<Response> {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: SiteStreamEvent) => {
        controller.enqueue(encodeServerSentEvent(event));
      };

      try {
        await runSiteGeneration({ ...options, emit });
      } catch (error) {
        logger.error("Site generation failed", { error_message: getErrorMessage(error) });
        emit({ type: "error", error: getErrorMessage(error) });
      } finally {
        controller.enqueue(encodeServerSentEventDone());
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
