import type { TeammateResponse, TeammateSummary } from "@ngriffin_uk/polychat-schemas";
import { findPlatformTeammate } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { findModelConfig } from "~/lib/providers/models";
import type { ProjectCapabilityRow } from "~/repositories/WorkspaceRepository";
import { MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { listSkillSummaries } from "~/services/skills";
import { resolveProjectSkillGrants } from "~/services/skills/scope";
import { getAvailableTools } from "~/services/tools/toolsOperations";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";

import {
  isTeammateAvailableToWorkspace,
  listProjectDefaultTeammateIds,
  resolveProjectTeammateIds,
} from "./access";
import { buildTeammateCompletionTools } from "./completion-tools";
import { ensurePlatformTeammates } from "./platform-teammates";
import { getUserTeammates } from "./teammateCrud";
import { normaliseTeammateResponse } from "./teammateResponse";

interface TeammateScopeAvailability {
  skillIds: ReadonlySet<string>;
  toolIds: ReadonlySet<string>;
}

const CORE_TEAMMATE_TOOL_IDS = new Set(buildTeammateCompletionTools().map((tool) => tool.name));

function resolveAvailableToolIds(
  teammate: TeammateResponse,
  availability: TeammateScopeAvailability,
): ReadonlySet<string> {
  const available = new Set([...availability.toolIds, ...CORE_TEAMMATE_TOOL_IDS]);
  const platformTeammate = findPlatformTeammate(teammate.id);

  for (const toolId of platformTeammate?.tools ?? []) {
    available.add(toolId);
  }

  return available;
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
  teammates: readonly TeammateResponse[],
): Promise<ReadonlySet<string>> {
  const pinnedModels = [
    ...new Set(
      teammates.map((teammate) => teammate.model).filter((model): model is string => !!model),
    ),
  ];
  const resolved = await Promise.all(
    pinnedModels.map(async (model) =>
      (await findModelConfig(model, context.env)) ? model : undefined,
    ),
  );

  return new Set(resolved.filter((model): model is string => !!model));
}

function toTeammateSummary(
  teammate: TeammateResponse,
  availability: TeammateScopeAvailability,
  executableModels: ReadonlySet<string>,
  scorecards: ReadonlyMap<string, { good: number; bad: number }>,
): TeammateSummary {
  const toolIds = teammate.enabled_tools ?? [];
  const availableToolIds = resolveAvailableToolIds(teammate, availability);

  return {
    id: teammate.id,
    name: teammate.name,
    kind: teammate.kind,
    description: teammate.description,
    avatarUrl: teammate.avatar_url,
    model: teammate.model,
    modelAvailable: teammate.model ? executableModels.has(teammate.model) : true,
    mode: teammate.mode,
    ownerScopeType: teammate.owner_scope_type,
    skillIds: teammate.skill_ids,
    toolIds,
    unavailableSkillIds: teammate.skill_ids.filter(
      (skillId) => !availability.skillIds.has(skillId),
    ),
    unavailableToolIds: toolIds.filter((toolId) => !availableToolIds.has(toolId)),
    scorecard: scorecards.get(teammate.id) ?? { good: 0, bad: 0 },
  };
}

async function summarise(
  context: ServiceContext,
  teammates: readonly TeammateResponse[],
  availability: TeammateScopeAvailability,
): Promise<TeammateSummary[]> {
  const [executableModels, scorecards] = await Promise.all([
    resolveExecutableModels(context, teammates),
    context.repositories.teammateFeedback.scorecardsFor(teammates.map((teammate) => teammate.id)),
  ]);

  return teammates.map((teammate) =>
    toTeammateSummary(teammate, availability, executableModels, scorecards),
  );
}

async function listProjectTeammates(
  context: ServiceContext,
  workspaceId: string,
  teammateIds: string[],
): Promise<TeammateResponse[]> {
  const rows = await context.repositories.teammates.getTeammatesByIds(teammateIds);
  const availableRows = await Promise.all(
    rows.map(async (row) =>
      (await isTeammateAvailableToWorkspace(context, row, workspaceId)) ? row : undefined,
    ),
  );

  return availableRows
    .filter((row): row is Teammate => row !== undefined)
    .map((row) => normaliseTeammateResponse(row));
}

export async function listScopedTeammateSummaries(
  context: ServiceContext,
  userId?: number,
  projectId?: string,
): Promise<TeammateSummary[]> {
  if (projectId) {
    const { project } = await requireProjectAccess(context, projectId);

    await ensurePlatformTeammates(context);

    const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
    const defaultTeammateIds = await listProjectDefaultTeammateIds(context, project.workspace_id);
    const grantedTeammateIds = resolveProjectTeammateIds({ capabilities, defaultTeammateIds });

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
