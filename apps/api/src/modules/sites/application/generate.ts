import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  applySitePatch,
  buildSiteExampleStream,
  buildSiteGenerateUserPrompt,
  buildSitePlanGuidance,
  buildSiteRefineUserPrompt,
  catalogueSubsetId,
  collectSiteElementSubtree,
  componentsForSiteKind,
  componentsForSiteRefinement,
  createSitePatchStreamReader,
  describeSiteCatalog,
  describeSiteOutline,
  elementPatchPath,
  hasSiteErrors,
  serialiseSiteProjectForPrompt,
  SITE_COMPONENT_TYPES,
  validateSiteProject,
  type ResolvedRefineIntent,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  ModelTier,
  SiteElementTarget,
  SiteGenerateRequest,
  SiteIssue,
  SitePlan,
  SiteQuality,
  SiteRecord,
  SiteStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
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

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { sseResponse } from "~/infrastructure/http/streaming";
import type { IUser } from "~/types";

import { resolveSiteGenerationModel } from "./model";
import { classifySiteRefinement, planSite, scoreSite } from "./plan";
import { readProviderTextStream } from "./provider-text-stream";
import { createSite, getSite, updateSite } from "./records";

const logger = getLogger({ prefix: "services/sites/generate" });

const SITE_GENERATION_MAX_TOKENS = 24_000;

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
}

function buildInitialDocument(request: SiteGenerateRequest, plan: SitePlan) {
  return {
    title: request.prompt.slice(0, 60).trim(),
    theme: plan.theme,
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

    const intent = request.target
      ? null
      : await classifySiteRefinement({
          env: context.env,
          user,
          prompt: request.prompt,
          project: existing.project,
          plan: existing.plan,
          completionId,
        });
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
      system:
        target && targetPage
          ? renderPrompt("apps/sites/refine-element", {
              components,
              pageId: target.pageId,
              targetPath: elementPatchPath(target.pageId, target.elementKey),
              outline: describeSiteOutline(existing.project),
              element: JSON.stringify(collectSiteElementSubtree(targetPage, target.elementKey)),
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

  const plan = await planSite({
    env: context.env,
    user,
    prompt: request.prompt,
    themeHint: request.theme,
    completionId,
  });

  const overrides = options.overrides ?? {};
  const subset =
    overrides.subset === false ? SITE_COMPONENT_TYPES : componentsForSiteKind(plan.kind);

  return {
    plan,
    tier: overrides.tier ?? plan.tier,
    existing: null,
    intent: null,
    target: null,
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

export async function runSiteGeneration(
  options: RunSiteGenerationOptions,
): Promise<SiteGenerationResult> {
  const { context, user, request, signal } = options;
  const emit = options.emit ?? (() => {});
  const completionId = `site-${generateId()}`;
  const prepared = await prepareGeneration(options, completionId);
  const generationModel = await resolveSiteGenerationModel({
    env: context.env,
    user,
    tier: prepared.tier,
    requestedModel: request.model,
  });
  const plan: SitePlan = {
    ...prepared.plan,
    provider: generationModel.provider,
    model: generationModel.model,
  };

  emit({ type: "plan", plan });

  if (prepared.intent) {
    emit({
      type: "intent",
      intent: prepared.intent.intent,
      tier: prepared.tier,
      target: prepared.target,
      confidence: prepared.intent.confidence,
    });
  }

  emit({ type: "model", provider: generationModel.provider, model: generationModel.model });

  const providerStream = await ai.stream({
    env: context.env,
    user,
    model: generationModel.model,
    provider: generationModel.provider,
    system: prepared.system,
    prompt: prepared.prompt,
    store: false,
    completion_id: completionId,
    enabled_tools: [],
    tools: [],
    disable_functions: true,
    mode: "normal",
    platform: "tool-run",
    max_tokens: SITE_GENERATION_MAX_TOKENS,
    prompt_cache_key: prepared.cacheKey,
    ...(generationModel.effort
      ? { reasoning_effort: generationModel.effort }
      : { reasoning: { effort: "none" } }),
  });

  if (!(providerStream instanceof ReadableStream)) {
    throw new AssistantError("The model did not stream a response", ErrorType.PROVIDER_ERROR);
  }

  const reader = createSitePatchStreamReader();
  const document = prepared.document;
  let applied = 0;
  let rejected = 0;
  const apply = (patches: ReturnType<typeof reader.push>) => {
    for (const patch of patches) {
      try {
        applySitePatch(document, patch);
        applied += 1;
        emit({ type: "patch", patch });
      } catch (error) {
        rejected += 1;
        logger.warn("Dropped a site patch", {
          completion_id: completionId,
          path: patch.path,
          error_message: getErrorMessage(error),
        });
      }
    }
  };

  for await (const delta of readProviderTextStream(providerStream, signal)) {
    apply(reader.push(delta));
  }

  apply(reader.flush());

  const { project, issues } = validateSiteProject(document);

  logger.info("Site generation finished", {
    completion_id: completionId,
    applied,
    rejected,
    skipped_lines: reader.skippedLines(),
    issues: issues.length,
    pages: Object.keys(project.pages).length,
  });

  if (hasSiteErrors(issues)) {
    throw new AssistantError(
      issues.find((issue) => issue.severity === "error")?.message ?? "Generation failed",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const brief = prepared.existing?.brief ?? request.prompt;
  const quality = options.skipQuality
    ? null
    : await scoreSite({ env: context.env, user, brief, project, issues, completionId });
  const scope = { context, userId: user.id, projectId: request.projectId };
  const turn = {
    id: completionId,
    role: "user" as const,
    prompt: request.prompt,
    createdAt: new Date().toISOString(),
    plan,
    ...(prepared.intent ? { intent: prepared.intent.intent } : {}),
    ...(prepared.target ? { target: prepared.target } : {}),
    provider: generationModel.provider,
    model: generationModel.model,
  };
  const site =
    options.persist === false
      ? {
          id: completionId,
          title: project.title,
          brief,
          projectId: request.projectId ?? null,
          revision: 0,
          plan,
          project,
          issues,
          quality,
          turns: [turn],
          createdAt: turn.createdAt,
          updatedAt: null,
        }
      : prepared.existing
        ? await updateSite(scope, prepared.existing.id, {
            brief,
            plan,
            project,
            issues,
            quality,
            turn,
          })
        : await createSite(scope, { brief, plan, project, issues, quality, turn });

  emit({ type: "saved", site });
  emit({ type: "done", issues, quality });

  return { site, plan, issues, quality };
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
