import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { IRequest } from "~/types";
import type { RequestCache } from "~/utils/requestCache";

import { listSkillAvailability } from "./availability";
import type { LoadedSkillRuntime, SkillCatalog } from "./catalog";
import { buildSkillAvailabilityInput, resolveSkillScope } from "./scope";

const REQUEST_SKILL_RUNTIME_KEY = "skills:pinned-runtime";

export interface RequestSkillRuntimeState {
  catalog: SkillCatalog;
}

export function seedRequestSkillRuntime(cache: RequestCache, catalog: SkillCatalog): void {
  cache.set(REQUEST_SKILL_RUNTIME_KEY, { catalog } satisfies RequestSkillRuntimeState);
}

export function getRequestSkillRuntime(
  cache: RequestCache | undefined,
): RequestSkillRuntimeState | null {
  const state = cache?.get(REQUEST_SKILL_RUNTIME_KEY);

  return state && typeof state === "object" && "catalog" in state
    ? (state as RequestSkillRuntimeState)
    : null;
}

export async function resolvePinnedRequestSkillState(
  request: IRequest,
  state: RequestSkillRuntimeState,
): Promise<{ catalog: SkillCatalog; skills: SkillAvailability[] }> {
  const model = request.request?.model;
  const modelConfig = model
    ? await getModelConfigByMatchingModel(model, undefined, request.request?.provider)
    : undefined;
  const skillScope = await resolveSkillScope(request);
  const skills = await listSkillAvailability(
    buildSkillAvailabilityInput({
      skillScope,
      supportsToolCalls: modelConfig?.supportsToolCalls ?? true,
      enabledToolIds: new Set(request.request?.enabled_tools ?? []),
    }),
    state.catalog.listDefinitions(),
  );

  return { catalog: state.catalog, skills };
}

export async function isPinnedAuthoredSkillAuthorised(
  request: IRequest,
  loaded: LoadedSkillRuntime,
): Promise<boolean> {
  const context = request.context;
  const provenance = loaded.provenance;
  const authorisation = loaded.authorisation;

  if (!provenance || !authorisation) {
    return true;
  }

  if (!context) {
    return false;
  }

  const scope =
    provenance.scope === "personal"
      ? { type: "personal" as const, id: context.requireUser().id }
      : {
          type: "project" as const,
          id: request.memoryScope?.type === "project" ? request.memoryScope.projectId : "",
        };

  if (!scope.id || String(scope.id) !== authorisation.scopeId) {
    return false;
  }

  const current = await context.repositories.authoredSkills.getByScopeAndName(
    scope,
    provenance.skill,
  );

  return current?.id === authorisation.skillId;
}
