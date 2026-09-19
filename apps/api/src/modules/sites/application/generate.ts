import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  applySitePatch,
  buildSiteExampleStream,
  buildSiteGenerateUserPrompt,
  buildSitePlanGuidance,
  buildSiteRefineUserPrompt,
  createSitePatchStreamReader,
  describeSiteCatalog,
  hasSiteErrors,
  serialiseSiteProjectForPrompt,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteGenerateRequest,
  SitePlan,
  SiteRecord,
  SiteStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { sseResponse } from "~/infrastructure/http/streaming";
import type { IUser } from "~/types";

import { resolveSiteGenerationModel } from "./model";
import { planSite } from "./plan";
import { readProviderTextStream } from "./provider-text-stream";
import { createSite, getSite, updateSite } from "./records";

const logger = getLogger({ prefix: "services/sites/generate" });

const SITE_GENERATION_MAX_TOKENS = 24_000;

export interface StreamSiteGenerationOptions {
  context: ServiceContext;
  user: IUser;
  request: SiteGenerateRequest;
  signal?: AbortSignal;
}

interface PreparedGeneration {
  plan: SitePlan;
  existing: SiteRecord | null;
  system: string;
  prompt: string;
  document: Record<string, unknown>;
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
  const components = describeSiteCatalog();

  if (request.siteId) {
    const existing = await getSite(
      { context, userId: user.id, projectId: request.projectId },
      request.siteId,
    );

    return {
      plan: existing.plan,
      existing,
      system: renderPrompt("apps/sites/refine", {
        components,
        document: serialiseSiteProjectForPrompt(existing.project),
      }),
      prompt: buildSiteRefineUserPrompt(request.prompt),
      document: structuredClone(existing.project) as unknown as Record<string, unknown>,
    };
  }

  const plan = await planSite({
    env: context.env,
    user,
    prompt: request.prompt,
    themeHint: request.theme,
    completionId,
  });

  return {
    plan,
    existing: null,
    system: renderPrompt("apps/sites/generate", {
      example: buildSiteExampleStream(),
      components,
      guidance: buildSitePlanGuidance(plan),
    }),
    prompt: buildSiteGenerateUserPrompt(request.prompt),
    document: buildInitialDocument(request, plan),
  };
}

export async function streamSiteGeneration(
  options: StreamSiteGenerationOptions,
): Promise<Response> {
  const { context, user, request, signal } = options;
  const completionId = `site-${generateId()}`;
  const prepared = await prepareGeneration(options, completionId);
  const generationModel = await resolveSiteGenerationModel({
    env: context.env,
    user,
    tier: prepared.plan.tier,
    requestedModel: request.model,
  });
  const plan: SitePlan = {
    ...prepared.plan,
    provider: generationModel.provider,
    model: generationModel.model,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: SiteStreamEvent) => {
        controller.enqueue(encodeServerSentEvent(event));
      };

      try {
        emit({ type: "plan", plan });
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
          ...(generationModel.effort
            ? { reasoning_effort: generationModel.effort }
            : { reasoning: { effort: "none" } }),
        });

        if (!(providerStream instanceof ReadableStream)) {
          throw new Error("The model did not stream a response");
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
          emit({
            type: "error",
            error:
              issues.find((issue) => issue.severity === "error")?.message ?? "Generation failed",
          });

          return;
        }

        const scope = { context, userId: user.id, projectId: request.projectId };
        const turn = {
          id: completionId,
          role: "user" as const,
          prompt: request.prompt,
          createdAt: new Date().toISOString(),
          plan,
          provider: generationModel.provider,
          model: generationModel.model,
        };
        const saved = prepared.existing
          ? await updateSite(scope, prepared.existing.id, {
              brief: prepared.existing.brief,
              plan,
              project,
              issues,
              turn,
            })
          : await createSite(scope, { brief: request.prompt, plan, project, issues, turn });

        emit({ type: "saved", site: saved });
        emit({ type: "done", issues });
      } catch (error) {
        logger.error("Site generation failed", {
          completion_id: completionId,
          error_message: getErrorMessage(error),
        });
        emit({ type: "error", error: getErrorMessage(error) });
      } finally {
        controller.enqueue(encodeServerSentEventDone());
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
