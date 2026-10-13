import { getModels } from "@ngriffin_uk/polychat-ai-models";
import { isProviderPlatformEnabled } from "@ngriffin_uk/polychat-ai-providers";
import type { Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import {
  getModelDisplayName,
  isActiveModel,
  modelHasInputModalities,
  modelHasOutputModality,
  type BenchmarkEntrant,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import type { AuthorisedModelTarget } from "~/modules/chat/application/streaming/responses";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { IEnv, IUser } from "~/types";

export type EntrantTarget =
  | { kind: "chat"; model: AuthorisedModelTarget }
  | { kind: "decision"; model: AuthorisedModelTarget }
  | { kind: "route"; route: ModelRouteRecord };

export function isDecisionModel(config: ModelConfigItem): boolean {
  return modelHasOutputModality(config, "decision");
}

export function modelIneligibility(benchmark: Benchmark, config: ModelConfigItem): string | null {
  if (!isActiveModel(config)) {
    return "This model has been retired";
  }

  if (isDecisionModel(config)) {
    return benchmark.summary.decisionModels
      ? null
      : `Decision models only play benchmarks built for them, not ${benchmark.summary.name}`;
  }

  if (!modelHasOutputModality(config, "text")) {
    return "Only models that answer in text can enter";
  }

  if (
    benchmark.summary.input === "image" &&
    config.multimodal !== true &&
    !modelHasInputModalities(config, ["image"])
  ) {
    return "No eyes for this one: the model cannot read images";
  }

  return null;
}

export function modelEntrant(modelId: string, config: ModelConfigItem): BenchmarkEntrant {
  return { kind: "model", modelId, provider: config.provider, name: getModelDisplayName(config) };
}

export function findPlatformModel(env: IEnv, modelId: string): ModelConfigItem | null {
  const config = getModels()[modelId];

  return config && isProviderPlatformEnabled(config.provider, env)
    ? { ...config, id: modelId }
    : null;
}

export function isOfficialProvider(provider: string): boolean {
  return (BENCHMARKS_CONFIG.officialProviders as readonly string[]).includes(provider);
}

/**
 * A model the official queue may run: on the platform's own credentials and from an approved lab.
 * Explicit admin requests go through the same gate, so nothing else ever reaches a public board.
 */
export function findOfficialModel(env: IEnv, modelId: string): ModelConfigItem | null {
  const config = findPlatformModel(env, modelId);

  return config && isOfficialProvider(config.provider) ? config : null;
}

export async function resolveModelTarget(
  env: IEnv,
  user: IUser | null,
  entrant: Extract<BenchmarkEntrant, { kind: "model" }>,
): Promise<AuthorisedModelTarget> {
  if (user) {
    const resolved = await resolveExecutableModelForRequest({
      env,
      user,
      model: entrant.modelId,
      provider: entrant.provider,
    });

    return {
      config: { ...resolved.config, id: resolved.id },
      credentialAuthority: resolved.credentialAuthority,
    };
  }

  const config = findPlatformModel(env, entrant.modelId);

  if (!config) {
    throw new AssistantError(
      `${entrant.name} is not available on the platform`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return { config, credentialAuthority: "platform" };
}

export async function resolveEntrantTarget(
  env: IEnv,
  repositories: RepositoryManager,
  user: IUser | null,
  entrant: BenchmarkEntrant,
): Promise<EntrantTarget> {
  if (entrant.kind === "route") {
    const route = await repositories.modelRoutes.getRoute(entrant.workspaceId, entrant.routeId);

    if (!route || route.status !== "active") {
      throw new AssistantError("This model route is no longer active", ErrorType.NOT_FOUND, 404);
    }

    return { kind: "route", route };
  }

  if (entrant.kind === "human") {
    throw new AssistantError("People play through the play endpoint", ErrorType.PARAMS_ERROR);
  }

  const model = await resolveModelTarget(env, user, entrant);

  return isDecisionModel(model.config) ? { kind: "decision", model } : { kind: "chat", model };
}
