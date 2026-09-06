import {
  findFlowStage,
  PROJECT_TASK_TOOL_IDS,
  type ProjectFlow,
  type ProjectFlowStage,
  type ProjectTask,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { resolveProjectSkillGrants } from "~/services/skills/scope";
import { assertTeammateAvailableToWorkspace } from "~/services/teammates/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import { toStringArray } from "~/utils/arrays";
import { intersectEnabledTools, intersectGrantedIds } from "~/utils/enabledTools";
import { AssistantError, ErrorType } from "~/utils/errors";

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

async function resolveProjectTeammate(
  context: ServiceContext,
  projectId: string,
  teammateId: string,
): Promise<Teammate> {
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
  const isAttached = capabilities.some(
    (capability) => capability.kind === "teammate" && capability.capability_id === teammateId,
  );

  if (!isAttached) {
    throw new AssistantError(
      "That teammate is not attached to this project",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const teammate = await context.repositories.teammates.getTeammateById(teammateId);

  if (!teammate) {
    throw new AssistantError("Teammate not found", ErrorType.NOT_FOUND, 404);
  }

  const project = await context.repositories.workspaces.getProject(projectId);

  if (!project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  await assertTeammateAvailableToWorkspace(context, teammate, project.workspace_id);

  return teammate;
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
    ? await resolveProjectTeammate(context, task.projectId, teammateId)
    : null;
  const configuredTools = teammate
    ? intersectEnabledTools(projectTools, teammate.enabled_tools)
    : projectTools;

  return {
    stage,
    teammate,
    model: task.runner?.model ?? teammate?.model ?? null,
    mode: stage?.mode ?? task.runner?.mode ?? teammate?.mode ?? DEFAULT_TASK_MODE,
    enabledTools: withoutForbiddenTools(
      [...new Set([...configuredTools, ...PROJECT_TASK_TOOL_IDS])],
      task.constraints?.forbiddenTools,
    ),
    skillIds: intersectGrantedIds(projectSkillIds, resolveRequestedSkillIds(stage, teammate)),
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
