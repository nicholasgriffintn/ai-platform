import type { CreateTeammateInput, UpdateTeammateInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { teammateOwnerScopeForUser, requireTeammateAccess } from "./access";
import { normaliseTeammateResponse } from "./teammateResponse";

export async function getUserTeammates(context: ServiceContext, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;
  const workspaces = await context.repositories.workspaces.listWorkspaces(id);

  return (
    await context.repositories.agents.getTeammatesForScopes(
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

  const agent = await context.repositories.agents.createTeammate({
    userId: currentUser.id,
    ...(await resolveNewTeammateOwnerScope(context, currentUser.id, params.workspace_id)),
    kind: params.kind ?? "colleague",
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

  return normaliseTeammateResponse(agent);
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
  await context.repositories.agents.updateTeammate(teammateId, updates);

  return getTeammateById(context, teammateId, id);
}

async function findProjectsUsingTeammate(context: ServiceContext, teammateId: string) {
  const [attached, inFlows] = await Promise.all([
    context.repositories.workspaces.listProjectsWithCapability("agent", teammateId),
    context.repositories.workspaces.listProjectsWithFlowStageTeammate(teammateId),
  ]);

  return [...new Map([...attached, ...inFlows].map((project) => [project.id, project])).values()];
}

async function unpublishSharedTeammate(
  context: ServiceContext,
  teammateId: string,
  userId: number,
) {
  const listing = await context.repositories.sharedAgents.getSharedTeammateByTeammateId(teammateId);

  if (listing) {
    await context.repositories.sharedAgents.deleteSharedTeammate(userId, listing.id);
  }

  const install = await context.repositories.sharedAgents.getInstallByTeammateId(
    userId,
    teammateId,
  );

  if (install) {
    await context.repositories.sharedAgents.uninstallTeammate(userId, teammateId);
  }
}

export async function deleteTeammate(context: ServiceContext, teammateId: string, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireTeammateAccess(context, teammateId, "write", id);

  const projects = await findProjectsUsingTeammate(context, teammateId);

  if (projects.length > 0) {
    throw new AssistantError(
      `This agent is still used by ${projects.length} project${projects.length === 1 ? "" : "s"}: ${projects
        .map((project) => project.name)
        .join(
          ", ",
        )}. Detach it from each project, and remove it from any flow stage, before deleting it.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await unpublishSharedTeammate(context, teammateId, id);
  await context.repositories.agents.deleteTeammate(teammateId);

  return { success: true };
}
