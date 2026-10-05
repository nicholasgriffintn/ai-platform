import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  findProjectFlowNode,
  readToolIds,
  PROJECT_TASK_INTERACTION_TOOL_IDS,
  PROJECT_TASK_TOOL_IDS,
  DOCUMENT_READ_TOOL_NAME,
  NATIVE_RECORD_READ_TOOL_NAME,
  type ProjectFlow,
  type ProjectFlowAgentNode,
  type ProjectTask,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { toStringArray } from "@ngriffin_uk/polychat-utility-server/arrays";
import {
  intersectEnabledTools,
  intersectGrantedIds,
} from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Teammate } from "~/infrastructure/database/schema";
import { resolveProjectSkillGrants } from "~/modules/skills/application/scope";
import { isPlatformTeammate, requireProjectTeammate } from "~/modules/teammates/application/access";
import { readTeammateSkillIds } from "~/modules/teammates/application/teammateResponse";
import {
  PROJECT_CODING_TOOL_IDS,
  resolveProjectCodingEnvironment,
} from "~/modules/workspaces/application/projectCodingEnvironment";
import { resolveProjectTools } from "~/modules/workspaces/application/projectTools";

const DEFAULT_TASK_MODE = "teammate";

export interface ResolvedTaskRuntime {
  node: ProjectFlowAgentNode | null;
  teammate: Teammate | null;
  model: string | null;
  mode: string;
  enabledTools: string[];
  skillIds: string[];
  requireApprovalFor: ToolPermission[];
  enforceModeToolPolicy: false;
  humanReview: boolean;
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
  node: ProjectFlowAgentNode | null,
  teammate: Teammate | null,
): string[] {
  return [...new Set([...(node?.skillIds ?? []), ...toStringArray(teammate?.skill_ids)])];
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
  const currentNode = findProjectFlowNode(flow, task.nodeId);
  const node = currentNode?.type === "agent" ? currentNode : null;
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(
    task.projectId,
  );
  const projectTools = resolveProjectTools(capabilities).enabledTools;
  const projectSkillIds = resolveProjectSkillGrants(capabilities);
  const teammateId = node?.teammateId ?? task.runner?.teammateId ?? null;
  const teammate = teammateId
    ? await requireProjectTeammate(context, task.projectId, teammateId)
    : null;
  const configuredTools = resolveTeammateTools(projectTools, teammate);
  const project = await context.repositories.workspaces.getProject(task.projectId);
  const codingTools = resolveProjectCodingEnvironment(project) ? PROJECT_CODING_TOOL_IDS : [];
  const grantedSkillIds = resolveTeammateSkillIds(projectSkillIds, teammate);

  return {
    node,
    teammate,
    model: task.runner?.model ?? teammate?.model ?? null,
    mode: node?.mode ?? task.runner?.mode ?? teammate?.mode ?? DEFAULT_TASK_MODE,
    enabledTools: withoutForbiddenTools(
      [
        ...new Set([
          ...configuredTools,
          ...PROJECT_TASK_TOOL_IDS,
          DOCUMENT_READ_TOOL_NAME,
          NATIVE_RECORD_READ_TOOL_NAME,
          ...PROJECT_TASK_INTERACTION_TOOL_IDS,
          ...codingTools,
        ]),
      ],
      task.constraints?.forbiddenTools,
    ),
    skillIds: intersectGrantedIds(grantedSkillIds, resolveRequestedSkillIds(node, teammate)),
    requireApprovalFor: [
      ...new Set([...(node?.requiresApprovalFor ?? []), ...task.requireApprovalFor]),
    ],
    enforceModeToolPolicy: false,
    humanReview: Boolean(node && findProjectFlowNode(flow, node.next)?.type === "human_wait"),
  };
}

export function buildNodeInstructions(
  runtime: Pick<ResolvedTaskRuntime, "node" | "skillIds"> & { humanReview?: boolean },
): string | null {
  const { node, skillIds } = runtime;

  if (!node && skillIds.length === 0) {
    return null;
  }

  const instructions = renderPrompt("apps/project-tasks/node-instructions", {
    nodeName: node?.name,
    nodeInstructions: node?.instructions || undefined,
    skillIds: skillIds.length > 0 ? skillIds.join(", ") : undefined,
    humanReview: runtime.humanReview ? "true" : undefined,
  }).trim();

  return instructions || null;
}
