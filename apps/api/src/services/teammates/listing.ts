import {
  filterToolIdsForTeammateKind,
  type TeammateResponse,
  type TeammateSummary,
} from "@ngriffin_uk/polychat-schemas";

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

import { isTeammateAvailableToWorkspace, resolveProjectTeammateGrants } from "./access";
import { getUserTeammates } from "./teammateCrud";
import { normaliseTeammateResponse } from "./teammateResponse";

interface TeammateScopeAvailability {
  skillIds: ReadonlySet<string>;
  toolIds: ReadonlySet<string>;
}

async function builtInSkillIds(): Promise<string[]> {
  return (await listSkillSummaries()).map((skill) => skill.id);
}

async function toProjectScopeAvailability(
  capabilities: ProjectCapabilityRow[],
): Promise<TeammateScopeAvailability> {
  return {
    skillIds: new Set([...(await builtInSkillIds()), ...resolveProjectSkillGrants(capabilities)]),
    toolIds: new Set(resolveProjectTools(capabilities).enabledTools),
  };
}

async function resolvePersonalScopeAvailability(
  context: ServiceContext,
  userId: number,
): Promise<TeammateScopeAvailability> {
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
  agents: readonly TeammateResponse[],
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

function toTeammateSummary(
  agent: TeammateResponse,
  availability: TeammateScopeAvailability,
  executableModels: ReadonlySet<string>,
): TeammateSummary {
  const toolIds = filterToolIdsForTeammateKind(agent.kind, agent.enabled_tools) ?? [];

  return {
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
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
  agents: readonly TeammateResponse[],
  availability: TeammateScopeAvailability,
): Promise<TeammateSummary[]> {
  const executableModels = await resolveExecutableModels(context, agents);

  return agents.map((agent) => toTeammateSummary(agent, availability, executableModels));
}

async function listProjectTeammates(
  context: ServiceContext,
  workspaceId: string,
  teammateIds: string[],
): Promise<TeammateResponse[]> {
  const rows = await context.repositories.agents.getTeammatesByIds(teammateIds);
  const availableRows = await Promise.all(
    rows.map(async (row) =>
      (await isTeammateAvailableToWorkspace(context, row, workspaceId)) ? row : undefined,
    ),
  );

  return availableRows
    .filter((row): row is Agent => row !== undefined)
    .map((row) => normaliseTeammateResponse(row));
}

export async function listScopedTeammateSummaries(
  context: ServiceContext,
  userId?: number,
  projectId?: string,
): Promise<TeammateSummary[]> {
  if (projectId) {
    const { project } = await requireProjectAccess(context, projectId);
    const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
    const grantedTeammateIds = resolveProjectTeammateGrants(capabilities);

    if (grantedTeammateIds.length === 0) {
      return [];
    }

    return summarise(
      context,
      await listProjectTeammates(context, project.workspace_id, grantedTeammateIds),
      await toProjectScopeAvailability(capabilities),
    );
  }

  if (userId) {
    return summarise(
      context,
      await getUserTeammates(context, userId),
      await resolvePersonalScopeAvailability(context, userId),
    );
  }

  return [];
}
