import {
  findFlowStage,
  readToolIds,
  PROJECT_TASK_INTERACTION_TOOL_IDS,
  PROJECT_TASK_TOOL_IDS,
  type ProjectFlow,
  type ProjectFlowStage,
  type ProjectTask,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { toStringArray } from "@ngriffin_uk/polychat-utility-server/arrays";
import {
  intersectEnabledTools,
  intersectGrantedIds,
} from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { resolveProjectSkillGrants } from "~/services/skills/scope";
import { isPlatformTeammate, requireProjectTeammate } from "~/services/teammates/access";
import { readTeammateSkillIds } from "~/services/teammates/teammateResponse";
import {
  PROJECT_CODING_TOOL_IDS,
  resolveProjectCodingEnvironment,
} from "~/services/workspaces/projectCodingEnvironment";
import { resolveProjectTools } from "~/services/workspaces/projectTools";

const DEFAULT_TASK_MODE = "teammate";

export interface ResolvedTaskRuntime {
  stage: ProjectFlowStage | null;
  teammate: Teammate | null;
  model: string | null;
  mode: string;
  enabledTools: string[];
  skillIds: string[];
  requireApprovalFor: ToolPermission[];
  enforceModeToolPolicy: false;
}

export function withoutForbiddenTools(
  tools: string[],
  forbidden: readonly string[] | undefined,
): string[] {
  if (!forbidden?.length) {
    return tools;
  }

  const denied = new Set(forbidden);

  return tools.filter((tool) => !denied.has(tool));
}

function resolveRequestedSkillIds(
  stage: ProjectFlowStage | null,
  teammate: Teammate | null,
): string[] {
  return [...new Set([...(stage?.skillIds ?? []), ...toStringArray(teammate?.skill_ids)])];
}

function resolveTeammateTools(projectTools: string[], teammate: Teammate | null): string[] {
  if (!teammate) {
    return projectTools;
  }

  if (isPlatformTeammate(teammate)) {
    return [...new Set([...projectTools, ...(readToolIds(teammate.enabled_tools) ?? [])])];
  }

  return intersectEnabledTools(projectTools, teammate.enabled_tools);
}

function resolveTeammateSkillIds(projectSkillIds: string[], teammate: Teammate | null): string[] {
  if (!teammate || !isPlatformTeammate(teammate)) {
    return projectSkillIds;
  }

  return [...projectSkillIds, ...readTeammateSkillIds(teammate.skill_ids)];
}

export async function resolveTaskRuntime(params: {
  context: ServiceContext;
  task: ProjectTask;
  flow: ProjectFlow | null;
}): Promise<ResolvedTaskRuntime> {
  const { context, task, flow } = params;
  const stage = findFlowStage(flow, task.stageId);
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(
    task.projectId,
  );
  const projectTools = resolveProjectTools(capabilities).enabledTools;
  const projectSkillIds = resolveProjectSkillGrants(capabilities);
  const teammateId = stage?.teammateId ?? task.runner?.teammateId ?? null;
  const teammate = teammateId
    ? await requireProjectTeammate(context, task.projectId, teammateId)
    : null;
  const configuredTools = resolveTeammateTools(projectTools, teammate);
  const project = await context.repositories.workspaces.getProject(task.projectId);
  const codingTools = resolveProjectCodingEnvironment(project) ? PROJECT_CODING_TOOL_IDS : [];
  const grantedSkillIds = resolveTeammateSkillIds(projectSkillIds, teammate);

  return {
    stage,
    teammate,
    model: task.runner?.model ?? teammate?.model ?? null,
    mode: stage?.mode ?? task.runner?.mode ?? teammate?.mode ?? DEFAULT_TASK_MODE,
    enabledTools: withoutForbiddenTools(
      [
        ...new Set([
          ...configuredTools,
          ...PROJECT_TASK_TOOL_IDS,
          ...PROJECT_TASK_INTERACTION_TOOL_IDS,
          ...codingTools,
        ]),
      ],
      task.constraints?.forbiddenTools,
    ),
    skillIds: intersectGrantedIds(grantedSkillIds, resolveRequestedSkillIds(stage, teammate)),
    requireApprovalFor: [
      ...new Set([...(stage?.requiresApprovalFor ?? []), ...task.requireApprovalFor]),
    ],
    enforceModeToolPolicy: false,
  };
}

export function buildStageInstructions(
  runtime: Pick<ResolvedTaskRuntime, "stage" | "skillIds">,
): string | null {
  const { stage, skillIds } = runtime;
  const lines: string[] = [];

  if (stage) {
    lines.push(`You are working the "${stage.name}" stage of this project's flow.`);

    if (stage.instructions) {
      lines.push(stage.instructions);
    }
  }

  if (skillIds.length > 0) {
    lines.push(`Load these skills before you start and follow them: ${skillIds.join(", ")}.`);
  }

  if (stage?.advance === "on_human_accept") {
    lines.push(
      "This stage ends with a person reviewing your work. Finish by stating what you did and what remains unproven.",
    );
  }

  return lines.length > 0 ? lines.join(" ") : null;
}
