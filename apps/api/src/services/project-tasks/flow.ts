import {
  findFlowStage,
  PROJECT_TASK_TOOL_IDS,
  type ProjectFlow,
  type ProjectFlowStage,
  type ProjectTask,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { AssistantError, ErrorType } from "~/utils/errors";

const PROJECT_TASK_FLOW_OWNED_TOOLS = new Set([
  "delegate_to_team_member",
  "delegate_to_team_member_by_role",
]);

export interface ResolvedTaskRuntime {
  stage: ProjectFlowStage | null;
  agent: Agent | null;
  model: string | null;
  mode: string;
  enabledTools: string[];
  requireApprovalFor: ToolPermission[];
  enforceModeToolPolicy: false;
}

async function resolveProjectAgent(
  context: ServiceContext,
  projectId: string,
  agentId: string,
): Promise<Agent> {
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
  const isAttached = capabilities.some(
    (capability) => capability.kind === "agent" && capability.capability_id === agentId,
  );

  if (!isAttached) {
    throw new AssistantError(
      "That agent is not attached to this project",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const agent = await context.repositories.agents.getAgentById(agentId);

  if (!agent) {
    throw new AssistantError("Agent not found", ErrorType.NOT_FOUND, 404);
  }

  return agent;
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

function withoutFlowOwnedTools(tools: string[]): string[] {
  return tools.filter((tool) => !PROJECT_TASK_FLOW_OWNED_TOOLS.has(tool));
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
  const conversationRunner = task.runner?.kind === "conversation" ? task.runner : null;
  const agentId = stage?.agentId ?? conversationRunner?.agentId ?? null;
  const agent = agentId ? await resolveProjectAgent(context, task.projectId, agentId) : null;
  const configuredTools = agent
    ? intersectEnabledTools(projectTools, agent.enabled_tools)
    : projectTools;

  return {
    stage,
    agent,
    model: conversationRunner?.model ?? agent?.model ?? null,
    mode: stage?.mode ?? conversationRunner?.mode ?? "agent",
    enabledTools: withoutForbiddenTools(
      withoutFlowOwnedTools([...new Set([...configuredTools, ...PROJECT_TASK_TOOL_IDS])]),
      task.constraints?.forbiddenTools,
    ),
    requireApprovalFor: [
      ...new Set([...(stage?.requiresApprovalFor ?? []), ...task.requireApprovalFor]),
    ],
    enforceModeToolPolicy: false,
  };
}

export function buildStageInstructions(stage: ProjectFlowStage | null): string | null {
  if (!stage) {
    return null;
  }

  const lines = [`You are working the "${stage.name}" stage of this project's flow.`];

  if (stage.instructions) {
    lines.push(stage.instructions);
  }

  if (stage.skillIds.length > 0) {
    lines.push(`Load these skills before you start and follow them: ${stage.skillIds.join(", ")}.`);
  }

  if (stage.advance === "on_human_accept") {
    lines.push(
      "This stage ends with a person reviewing your work. Finish by stating what you did and what remains unproven.",
    );
  }

  return lines.join(" ");
}
