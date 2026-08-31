import type { CreateAgentInput, UpdateAgentInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { agentOwnerScopeForUser, requireAgentAccess } from "./access";
import { normaliseAgentResponse } from "./agentResponse";

export async function getUserAgents(context: ServiceContext, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;
  const workspaces = await context.repositories.workspaces.listWorkspaces(id);

  return (
    await context.repositories.agents.getAgentsForScopes(
      id,
      workspaces.map((workspace) => workspace.id),
    )
  ).map(normaliseAgentResponse);
}

export async function getUserTeamAgents(context: ServiceContext, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  return (await context.repositories.agents.getTeamAgents(id)).map(normaliseAgentResponse);
}

export async function getAgentsByTeam(context: ServiceContext, teamId: string, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  return (await context.repositories.agents.getAgentsByTeamAndUser(teamId, id)).map(
    normaliseAgentResponse,
  );
}

export async function getAgentById(context: ServiceContext, agentId: string, userId?: number) {
  context.ensureDatabase();

  return normaliseAgentResponse(await requireAgentAccess(context, agentId, "read", userId));
}

export async function createAgent(context: ServiceContext, params: CreateAgentInput, user?: IUser) {
  context.ensureDatabase();
  const currentUser = user ?? context.requireUser();

  const agent = await context.repositories.agents.createAgent({
    userId: currentUser.id,
    ...agentOwnerScopeForUser(currentUser.id),
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
    teamId: params.team_id,
    teamRole: params.team_role,
    isTeamAgent: params.is_team_agent,
  });

  return normaliseAgentResponse(agent);
}

export async function updateAgent(
  context: ServiceContext,
  agentId: string,
  updates: UpdateAgentInput,
  userId?: number,
) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireAgentAccess(context, agentId, "write", id);
  await context.repositories.agents.updateAgent(agentId, updates);

  return getAgentById(context, agentId, id);
}

async function findProjectsUsingAgent(context: ServiceContext, agentId: string) {
  const [attached, inFlows] = await Promise.all([
    context.repositories.workspaces.listProjectsWithCapability("agent", agentId),
    context.repositories.workspaces.listProjectsWithFlowStageAgent(agentId),
  ]);

  return [...new Map([...attached, ...inFlows].map((project) => [project.id, project])).values()];
}

async function unpublishSharedAgent(context: ServiceContext, agentId: string, userId: number) {
  const listing = await context.repositories.sharedAgents.getSharedAgentByAgentId(agentId);

  if (listing) {
    await context.repositories.sharedAgents.deleteSharedAgent(userId, listing.id);
  }

  const install = await context.repositories.sharedAgents.getInstallByAgentId(userId, agentId);

  if (install) {
    await context.repositories.sharedAgents.uninstallAgent(userId, agentId);
  }
}

export async function deleteAgent(context: ServiceContext, agentId: string, userId?: number) {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireAgentAccess(context, agentId, "write", id);

  const projects = await findProjectsUsingAgent(context, agentId);

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

  await unpublishSharedAgent(context, agentId, id);
  await context.repositories.agents.deleteAgent(agentId);

  return { success: true };
}
