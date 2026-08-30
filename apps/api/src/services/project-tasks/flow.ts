import {
  findFlowStage,
  permissionsForCapabilities,
  permissionsForConsequences,
  type ProjectFlow,
  type ProjectFlowStage,
  type ProjectTask,
  type ProjectTaskCapability,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { listFunctionTools } from "~/services/functions";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface ResolvedTaskRuntime {
  stage: ProjectFlowStage | null;
  agent: Agent | null;
  model: string | null;
  mode: string;
  enabledTools: string[];
  requireApprovalFor: ToolPermission[];
}

export function intersectAgentTools(
  agentTools: unknown,
  projectTools: readonly string[],
): string[] {
  if (!Array.isArray(agentTools)) {
    return [...projectTools];
  }

  const allowed = new Set(projectTools);

  return agentTools.filter((tool): tool is string => typeof tool === "string" && allowed.has(tool));
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

/**
 * A task's capabilities decide which permissions its tools may hold. A tool is
 * withheld unless every permission it declares is allowed, so selecting nothing
 * leaves only read, reasoning and human tools.
 */
export function toolsWithinCapabilities(
  tools: string[],
  capabilities: readonly ProjectTaskCapability[],
  permissionsByTool: Map<string, readonly ToolPermission[]>,
): string[] {
  const allowed = new Set(permissionsForCapabilities(capabilities));

  return tools.filter((tool) => {
    const required = permissionsByTool.get(tool);

    if (!required || required.length === 0) {
      return true;
    }

    return required.every((permission) => allowed.has(permission));
  });
}

function permissionsByTool(): Map<string, readonly ToolPermission[]> {
  return new Map(
    listFunctionTools().map((tool) => [tool.name, (tool.permissions ?? []) as ToolPermission[]]),
  );
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
  const agentId = stage?.agentId ?? task.runner?.agentId ?? null;
  const agent = agentId ? await resolveProjectAgent(context, task.projectId, agentId) : null;

  return {
    stage,
    agent,
    model: task.runner?.model ?? agent?.model ?? null,
    mode: stage?.mode ?? task.runner?.mode ?? "agent",
    enabledTools: toolsWithinCapabilities(
      withoutForbiddenTools(
        agent ? intersectAgentTools(agent.enabled_tools, projectTools) : projectTools,
        task.constraints?.forbiddenTools,
      ),
      task.capabilities,
      permissionsByTool(),
    ),
    requireApprovalFor: [
      ...(stage?.requiresApprovalFor ?? []),
      ...task.requireApprovalFor,
      ...permissionsForConsequences(task.approvalConsequences),
    ],
  };
}

export function buildStageInstructions(stage: ProjectFlowStage | null): string | null {
  if (!stage) {
    return null;
  }

  const lines = [`You are working the "${stage.name}" stage of this project's flow.`];

  if (stage.skillId) {
    lines.push(`Load the ${stage.skillId} skill before you start and follow it.`);
  }

  if (stage.advance === "on_human_accept") {
    lines.push(
      "This stage ends with a person reviewing your work. Finish by stating what you did and what remains unproven.",
    );
  }

  return lines.join(" ");
}
