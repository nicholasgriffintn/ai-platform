import { getModels } from "@ngriffin_uk/polychat-ai-models";
import type { Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import {
  getModelDisplayName,
  isActiveModel,
  modelHasInputModalities,
  modelHasOutputModality,
  type BenchmarkCredentialSource,
  type BenchmarkEntrant,
  type BenchmarkScope,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import type { AuthorisedModelTarget } from "~/modules/chat/application/streaming/responses";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { filterModelsForUserAccess } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

export type EntrantTarget =
  | { kind: "chat"; model: AuthorisedModelTarget }
  | { kind: "decision"; model: AuthorisedModelTarget }
  | { kind: "route"; route: ModelRouteRecord };

export type OfficialModels = Record<string, ModelConfigItem>;

const FATAL_ERROR_TYPES = new Set<string>([
  ErrorType.AUTHENTICATION_ERROR,
  ErrorType.AUTHORISATION_ERROR,
  ErrorType.CONFIGURATION_ERROR,
  ErrorType.NOT_FOUND,
]);
const FATAL_STATUS_CODES = new Set([401, 403, 404]);

export function isDecisionModel(config: ModelConfigItem): boolean {
  return modelHasOutputModality(config, "decision") && !modelHasOutputModality(config, "text");
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

export function isOfficialProvider(provider: string): boolean {
  return BENCHMARKS_CONFIG.officialProviders.includes(provider);
}

export function credentialSourceFor(config: ModelConfigItem): BenchmarkCredentialSource {
  return config.isPlatformEnabled === false ? "byok" : "platform";
}

export async function listOfficialModels(env: IEnv, user: IUser | null): Promise<OfficialModels> {
  const accessible = await filterModelsForUserAccess(getModels(), env, user?.id, {
    shouldUseCache: false,
  });

  return Object.fromEntries(
    Object.entries(accessible).flatMap(([id, config]) =>
      isOfficialProvider(config.provider) &&
      (config.isPlatformEnabled !== false || config.isByokEnabled === true)
        ? [[id, { ...config, id }]]
        : [],
    ),
  );
}

export function findOfficialModel(models: OfficialModels, modelId: string): ModelConfigItem | null {
  return models[modelId] ?? null;
}

export function officialRunRefusal(run: {
  scope: BenchmarkScope;
  entrant: BenchmarkEntrant;
}): string | null {
  return run.scope === "official" &&
    run.entrant.kind === "model" &&
    !isOfficialProvider(run.entrant.provider)
    ? `Official runs only go to approved labs, not ${run.entrant.provider}`
    : null;
}

export function isFatalEntrantError(error: unknown): boolean {
  if (!(error instanceof AssistantError)) {
    return false;
  }

  return (
    FATAL_ERROR_TYPES.has(error.type) ||
    (error.statusCode !== undefined && FATAL_STATUS_CODES.has(error.statusCode))
  );
}

export async function resolveModelTarget(
  env: IEnv,
  user: IUser | null,
  entrant: Extract<BenchmarkEntrant, { kind: "model" }>,
  scope: BenchmarkScope,
): Promise<AuthorisedModelTarget> {
  if (scope === "official") {
    const config = findOfficialModel(await listOfficialModels(env, user), entrant.modelId);

    if (!config) {
      throw new AssistantError(
        `${entrant.name} has no key to run on: add a ${entrant.provider} key or set the platform key`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { config, credentialAuthority: credentialSourceFor(config) };
  }

  if (!user) {
    throw new AssistantError(
      "Personal runs need the person who started them",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

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

export async function resolveEntrantTarget(
  env: IEnv,
  repositories: RepositoryManager,
  user: IUser | null,
  entrant: BenchmarkEntrant,
  scope: BenchmarkScope,
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

  const model = await resolveModelTarget(env, user, entrant, scope);

  return isDecisionModel(model.config) ? { kind: "decision", model } : { kind: "chat", model };
}
