import {
  readToolIds,
  PROJECT_TASK_INTERACTION_TOOL_IDS,
  PROJECT_TASK_TOOL_IDS,
  type ProjectFlowStage,
  type ProjectTask,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { toStringArray } from "@ngriffin_uk/polychat-utility-server/arrays";
import {
  excludeEnabledTools,
  intersectEnabledTools,
  intersectGrantedIds,
} from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { Teammate } from "~/infrastructure/database/schema";
import { isPlatformTeammate } from "~/modules/teammates/application/access";
import { readTeammateSkillIds } from "~/modules/teammates/application/teammateResponse";

export interface ResolvedTaskRuntime {
  readonly stage: ProjectFlowStage | null;
  readonly teammate: Teammate | null;
  readonly model: string | null;
  readonly mode: string;
  readonly enabledTools: readonly string[];
  readonly skillIds: readonly string[];
  readonly requireApprovalFor: readonly ToolPermission[];
  readonly enforceModeToolPolicy: false;
}

export function resolveDiffReviewRuntime(
  task: Readonly<ProjectTask>,
  stage: ProjectFlowStage | null,
): ResolvedTaskRuntime {
  return {
    stage,
    teammate: null,
    model: task.runner?.model ?? null,
    mode: "explore",
    enabledTools: ["get_task", "list_tasks", "ask_user", "complete_goal"],
    skillIds: [],
    requireApprovalFor: ["write", "network", "sandbox", "orchestration"],
    enforceModeToolPolicy: false,
  };
}

export function resolveGrantedTaskRuntime(params: {
  readonly task: Readonly<ProjectTask>;
  readonly stage: ProjectFlowStage | null;
  readonly teammate: Teammate | null;
  readonly projectTools: readonly string[];
  readonly projectSkillIds: readonly string[];
  readonly codingTools: readonly string[];
}): ResolvedTaskRuntime {
  const { task, stage, teammate, projectTools, projectSkillIds, codingTools } = params;
  const platformTeammate = teammate !== null && isPlatformTeammate(teammate);
  const configuredTools = teammate
    ? platformTeammate
      ? [...projectTools, ...(readToolIds(teammate.enabled_tools) ?? [])]
      : intersectEnabledTools(projectTools, teammate.enabled_tools)
    : projectTools;
  const grantedSkillIds = platformTeammate
    ? [...projectSkillIds, ...readTeammateSkillIds(teammate.skill_ids)]
    : projectSkillIds;
  const requestedSkillIds = [
    ...new Set([...(stage?.skillIds ?? []), ...toStringArray(teammate?.skill_ids)]),
  ];
  const enabledTools = [
    ...new Set([
      ...configuredTools,
      ...PROJECT_TASK_TOOL_IDS,
      ...PROJECT_TASK_INTERACTION_TOOL_IDS,
      ...codingTools,
    ]),
  ];

  return {
    stage,
    teammate,
    model: task.runner?.model ?? teammate?.model ?? null,
    mode: stage?.mode ?? task.runner?.mode ?? teammate?.mode ?? "teammate",
    enabledTools: excludeEnabledTools(enabledTools, task.constraints?.forbiddenTools),
    skillIds: intersectGrantedIds(grantedSkillIds, requestedSkillIds),
    requireApprovalFor: [
      ...new Set([...(stage?.requiresApprovalFor ?? []), ...task.requireApprovalFor]),
    ],
    enforceModeToolPolicy: false,
  };
}
