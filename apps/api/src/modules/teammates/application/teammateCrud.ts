import type { CreateTeammateInput, UpdateTeammateInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { SharedTeammateRepository } from "~/modules/teammates/infrastructure/SharedTeammateRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IUser } from "~/types";

import { teammateOwnerScopeForUser, requireTeammateAccess } from "./access";
import { mutateTeammateContextsWithCleanup } from "./context-lifecycle";
import { ensurePlatformTeammates } from "./platform-teammates";
import { normaliseTeammateResponse } from "./teammateResponse";

export async function getUserTeammates(context: ServiceContext, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await ensurePlatformTeammates(context);

  const workspaces = await context.repositories.get(WorkspaceRepository).listWorkspaces(id);

  return (
    await context.repositories.get(TeammateRepository).getTeammatesForScopes(
      id,
      workspaces.map((workspace) => workspace.id),
    )
  ).map(normaliseTeammateResponse);
}

export async function getTeammateById(
  context: ServiceContext,
  teammateId: string,
  userId?: number,
) {
  context.ensureDatabase();

  return normaliseTeammateResponse(
    await requireTeammateAccess(context, teammateId, "read", userId),
  );
}

async function resolveNewTeammateOwnerScope(
  context: ServiceContext,
  userId: number,
  workspaceId: string | undefined,
) {
  if (!workspaceId) {
    return teammateOwnerScopeForUser(userId);
  }

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);

  return { ownerScopeType: "workspace" as const, ownerScopeId: workspaceId };
}

export async function createTeammate(
  context: ServiceContext,
  params: CreateTeammateInput,
  user?: IUser,
) {
  context.ensureDatabase();
  const currentUser = user ?? context.requireUser();

  const teammate = await context.repositories.get(TeammateRepository).createTeammate({
    userId: currentUser.id,
    ...(await resolveNewTeammateOwnerScope(context, currentUser.id, params.workspace_id)),
    kind: params.kind ?? "colleague",
    workspaceDefault: params.workspace_default ?? false,
    name: params.name,
    description: params.description ?? "",
    avatarUrl: params.avatar_url || null,
    servers: params.servers || [],
    model: params.model,
    temperature: params.temperature,
    maxSteps: params.max_steps,
    systemPrompt: params.system_prompt,
    fewShotExamples: params.few_shot_examples,
    enabledTools: params.enabled_tools,
    skillIds: params.skill_ids,
    mode: params.mode,
  });

  return normaliseTeammateResponse(teammate);
}

export async function updateTeammate(
  context: ServiceContext,
  teammateId: string,
  updates: UpdateTeammateInput,
  userId?: number,
) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireTeammateAccess(context, teammateId, "write", id);

  await context.repositories.get(TeammateRepository).updateTeammate(teammateId, {
    ...updates,
    ...(updates.enabled_tools !== undefined ? { enabled_tools: updates.enabled_tools } : {}),
  });

  return getTeammateById(context, teammateId, id);
}

async function findProjectsUsingTeammate(context: ServiceContext, teammateId: string) {
  const [attached, inFlows] = await Promise.all([
    context.repositories
      .get(WorkspaceRepository)
      .listProjectsWithCapability("teammate", teammateId),
    context.repositories.get(WorkspaceRepository).listProjectsWithFlowStageTeammate(teammateId),
  ]);

  return [...new Map([...attached, ...inFlows].map((project) => [project.id, project])).values()];
}

async function unpublishSharedTeammate(
  context: ServiceContext,
  teammateId: string,
  userId: number,
) {
  const listing = await context.repositories
    .get(SharedTeammateRepository)
    .getSharedTeammateByTeammateId(teammateId);

  if (listing) {
    await context.repositories
      .get(SharedTeammateRepository)
      .deleteSharedTeammate(userId, listing.id);
  }

  const install = await context.repositories
    .get(SharedTeammateRepository)
    .getInstallByTeammateId(userId, teammateId);

  if (install) {
    await context.repositories.get(SharedTeammateRepository).uninstallTeammate(userId, teammateId);
  }
}

export async function deleteTeammate(context: ServiceContext, teammateId: string, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireTeammateAccess(context, teammateId, "write", id);

  const projects = await findProjectsUsingTeammate(context, teammateId);

  if (projects.length > 0) {
    throw new AssistantError(
      `This teammate is still used by ${projects.length} project${projects.length === 1 ? "" : "s"}: ${projects
        .map((project) => project.name)
        .join(
          ", ",
        )}. Detach it from each project, and remove it from any flow stage, before deleting it.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await unpublishSharedTeammate(context, teammateId, id);

  const teammateContexts = await context.repositories
    .get(TeammateContextRepository)
    .listAllForTeammates([teammateId]);

  await mutateTeammateContextsWithCleanup(
    context,
    teammateContexts,
    () => context.repositories.get(TeammateRepository).deleteTeammate(teammateId),
    { cleanupBeforeMutation: true },
  );

  return { success: true };
}
