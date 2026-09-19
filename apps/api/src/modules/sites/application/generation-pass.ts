import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { applySitePatch, createSitePatchStreamReader } from "@ngriffin_uk/polychat-library-sites";
import type { SitePatch, SiteTraceEntry } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

import type { SiteGenerationModel } from "./model";
import { readProviderTextStream } from "./provider-text-stream";

const logger = getLogger({ prefix: "services/sites/generation-pass" });
const SITE_GENERATION_MAX_TOKENS = 24_000;

export interface RunSiteGenerationPassOptions {
  env: IEnv;
  user: IUser;
  generationModel: SiteGenerationModel;
  system: string;
  prompt: string;
  document: Record<string, unknown>;
  completionId: string;
  cacheKey: string;
  signal?: AbortSignal;
  onProviderStreamOpened?: () => void;
  onFirstToken?: () => void;
  onPatch?: (patch: SitePatch) => void;
}

export interface SiteGenerationPassResult {
  patches: SitePatch[];
  applied: number;
  rejected: number;
  skippedLines: number;
  durationMs: number;
}

export function createSiteGenerationTrace({
  id,
  stage,
  outcome,
  result,
  provider,
  model,
  summary,
}: {
  id: string;
  stage: "build" | "repair";
  outcome: "applied" | "discarded";
  result: SiteGenerationPassResult;
  provider: string;
  model: string;
  summary?: string;
}): SiteTraceEntry {
  const action = stage === "build" ? "Built the site" : "Repaired the site";
  const noUpdatesSummary =
    result.rejected > 0 || result.skippedLines > 0
      ? "No site updates were applied because the response contained no valid patches"
      : "The model returned no site updates";

  return {
    kind: "generation",
    version: 1,
    id,
    stage,
    outcome,
    summary:
      summary ??
      (stage === "build" && result.applied === 0
        ? noUpdatesSummary
        : outcome === "applied"
          ? `${action} with ${result.applied} updates`
          : `Discarded ${result.applied} repair updates because they did not produce a valid site`),
    provider,
    model,
    patchCount: outcome === "applied" ? result.applied : 0,
    rejectedPatchCount: result.rejected,
    skippedLineCount: result.skippedLines,
    durationMs: result.durationMs,
    createdAt: new Date().toISOString(),
  };
}

export async function runSiteGenerationPass({
  env,
  user,
  generationModel,
  system,
  prompt,
  document,
  completionId,
  cacheKey,
  signal,
  onProviderStreamOpened,
  onFirstToken,
  onPatch,
}: RunSiteGenerationPassOptions): Promise<SiteGenerationPassResult> {
  const startedAt = Date.now();
  const providerStream = await ai.stream({
    env,
    user,
    model: generationModel.model,
    provider: generationModel.provider,
    system,
    prompt,
    store: false,
    completion_id: completionId,
    enabled_tools: [],
    tools: [],
    disable_functions: true,
    mode: "normal",
    platform: "tool-run",
    max_tokens: SITE_GENERATION_MAX_TOKENS,
    prompt_cache_key: cacheKey,
    ...(generationModel.effort
      ? { reasoning_effort: generationModel.effort }
      : { reasoning: { effort: "none" } }),
  });

  if (!(providerStream instanceof ReadableStream)) {
    throw new AssistantError("The model did not stream a response", ErrorType.PROVIDER_ERROR);
  }

  onProviderStreamOpened?.();

  const reader = createSitePatchStreamReader();
  const patches: SitePatch[] = [];
  let rejected = 0;
  const apply = (pending: ReturnType<typeof reader.push>) => {
    for (const patch of pending) {
      try {
        applySitePatch(document, patch);
        patches.push(patch);
        onPatch?.(patch);
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

  let receivedToken = false;

  for await (const delta of readProviderTextStream(providerStream, signal)) {
    if (!receivedToken) {
      receivedToken = true;
      onFirstToken?.();
    }

    apply(reader.push(delta));
  }

  apply(reader.flush());

  return {
    patches,
    applied: patches.length,
    rejected,
    skippedLines: reader.skippedLines(),
    durationMs: Date.now() - startedAt,
  };
}
