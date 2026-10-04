import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { findFlowStage, type ProjectFlow, type ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveProjectSkillGrants } from "~/modules/skills/application/scope";
import { requireProjectTeammate } from "~/modules/teammates/application/access";
import {
  PROJECT_CODING_TOOL_IDS,
  resolveProjectCodingEnvironment,
} from "~/modules/workspaces/application/projectCodingEnvironment";
import { resolveProjectTools } from "~/modules/workspaces/application/projectTools";

import {
  resolveDiffReviewRuntime,
  resolveGrantedTaskRuntime,
  type ResolvedTaskRuntime,
} from "./runtime-policy";

export async function resolveTaskRuntime(params: {
  readonly context: ServiceContext;
  readonly task: Readonly<ProjectTask>;
  readonly flow: ProjectFlow | null;
}): Promise<ResolvedTaskRuntime> {
  const { context, task, flow } = params;
  const stage = findFlowStage(flow, task.stageId);

  if (task.executionProfile === "diff_review") {
    return resolveDiffReviewRuntime(task, stage);
  }

  const capabilities = await context.repositories.workspaces.listProjectCapabilities(
    task.projectId,
  );
  const teammateId = stage?.teammateId ?? task.runner?.teammateId ?? null;
  const teammate = teammateId
    ? await requireProjectTeammate(context, task.projectId, teammateId)
    : null;
  const project = await context.repositories.workspaces.getProject(task.projectId);

  return resolveGrantedTaskRuntime({
    task,
    stage,
    teammate,
    projectTools: resolveProjectTools(capabilities).enabledTools,
    projectSkillIds: resolveProjectSkillGrants(capabilities),
    codingTools: resolveProjectCodingEnvironment(project) ? PROJECT_CODING_TOOL_IDS : [],
  });
}

export function buildStageInstructions(
  runtime: Pick<ResolvedTaskRuntime, "stage" | "skillIds">,
): string | null {
  const { stage, skillIds } = runtime;

  if (!stage && skillIds.length === 0) {
    return null;
  }

  const instructions = renderPrompt("apps/project-tasks/stage-instructions", {
    stageName: stage?.name,
    stageInstructions: stage?.instructions || undefined,
    skillIds: skillIds.length > 0 ? skillIds.join(", ") : undefined,
    humanReview: stage?.advance === "on_human_accept" ? "true" : undefined,
  }).trim();

  return instructions || null;
}
