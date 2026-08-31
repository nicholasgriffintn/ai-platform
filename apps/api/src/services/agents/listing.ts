import type { AgentResponse, AgentSummary } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { findModelConfig } from "~/lib/providers/models";
import type { ProjectCapabilityRow } from "~/repositories/WorkspaceRepository";
import { MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { listSkillSummaries } from "~/services/skills";
import { resolveProjectSkillGrants } from "~/services/skills/scope";
import { getAvailableTools } from "~/services/tools/toolsOperations";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";

import { isAgentAvailableToWorkspace, resolveProjectAgentGrants } from "./access";
import { getUserAgents } from "./agentCrud";
import { normaliseAgentResponse } from "./agentResponse";

interface AgentScopeAvailability {
  skillIds: ReadonlySet<string>;
  toolIds: ReadonlySet<string>;
}

async function builtInSkillIds(): Promise<string[]> {
  return (await listSkillSummaries()).map((skill) => skill.id);
}

async function toProjectScopeAvailability(
  capabilities: ProjectCapabilityRow[],
): Promise<AgentScopeAvailability> {
  return {
    skillIds: new Set([...(await builtInSkillIds()), ...resolveProjectSkillGrants(capabilities)]),
    toolIds: new Set(resolveProjectTools(capabilities).enabledTools),
  };
}

async function resolvePersonalScopeAvailability(
  context: ServiceContext,
  userId: number,
): Promise<AgentScopeAvailability> {
  const [builtInIds, authoredSkills] = await Promise.all([
    builtInSkillIds(),
    context.repositories.authoredSkills.listByScope({ type: "personal", id: userId }),
  ]);

  return {
    skillIds: new Set([...builtInIds, ...authoredSkills.map((skill) => skill.name)]),
    toolIds: new Set([
      ...getAvailableTools(context.user?.plan_id === "pro", true).map((tool) => tool.id),
      ...MODEL_TOOL_DEFINITIONS.map((definition) => definition.id),
    ]),
  };
}

async function resolveExecutableModels(
  context: ServiceContext,
  agents: readonly AgentResponse[],
): Promise<ReadonlySet<string>> {
  const pinnedModels = [
    ...new Set(agents.map((agent) => agent.model).filter((model): model is string => !!model)),
  ];
  const resolved = await Promise.all(
    pinnedModels.map(async (model) =>
      (await findModelConfig(model, context.env)) ? model : undefined,
    ),
  );

  return new Set(resolved.filter((model): model is string => !!model));
}

function toAgentSummary(
  agent: AgentResponse,
  availability: AgentScopeAvailability,
  executableModels: ReadonlySet<string>,
): AgentSummary {
  const toolIds = agent.enabled_tools ?? [];

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    avatarUrl: agent.avatar_url,
    model: agent.model,
    modelAvailable: agent.model ? executableModels.has(agent.model) : true,
    mode: agent.mode,
    ownerScopeType: agent.owner_scope_type,
    skillIds: agent.skill_ids,
    toolIds,
    unavailableSkillIds: agent.skill_ids.filter((skillId) => !availability.skillIds.has(skillId)),
    unavailableToolIds: toolIds.filter((toolId) => !availability.toolIds.has(toolId)),
  };
}

async function summarise(
  context: ServiceContext,
  agents: readonly AgentResponse[],
  availability: AgentScopeAvailability,
): Promise<AgentSummary[]> {
  const executableModels = await resolveExecutableModels(context, agents);

  return agents.map((agent) => toAgentSummary(agent, availability, executableModels));
}

async function listProjectAgents(
  context: ServiceContext,
  workspaceId: string,
  agentIds: string[],
): Promise<AgentResponse[]> {
  const rows = await context.repositories.agents.getAgentsByIds(agentIds);
  const availableRows = await Promise.all(
    rows.map(async (row) =>
      (await isAgentAvailableToWorkspace(context, row, workspaceId)) ? row : undefined,
    ),
  );

  return availableRows
    .filter((row): row is Agent => row !== undefined)
    .map((row) => normaliseAgentResponse(row));
}

export async function listScopedAgentSummaries(
  context: ServiceContext,
  userId?: number,
  projectId?: string,
): Promise<AgentSummary[]> {
  if (projectId) {
    const { project } = await requireProjectAccess(context, projectId);
    const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
    const grantedAgentIds = resolveProjectAgentGrants(capabilities);

    if (grantedAgentIds.length === 0) {
      return [];
    }

    return summarise(
      context,
      await listProjectAgents(context, project.workspace_id, grantedAgentIds),
      await toProjectScopeAvailability(capabilities),
    );
  }

  if (userId) {
    return summarise(
      context,
      await getUserAgents(context, userId),
      await resolvePersonalScopeAvailability(context, userId),
    );
  }

  return [];
}
