import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import { isWorkspaceAgent, requireAgentAccess } from "./access";
import { normaliseAgentResponse } from "./agentResponse";

export async function publishAgentToWorkspace(
  context: ServiceContext,
  agentId: string,
  workspaceId: string,
  userId?: number,
): Promise<AgentResponse> {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const source = normaliseAgentResponse(await requireAgentAccess(context, agentId, "read", id));

  if (isWorkspaceAgent(source)) {
    throw new AssistantError(
      "That agent is already owned by a workspace",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const published = await context.repositories.agents.createAgent({
    userId: id,
    ownerScopeType: "workspace",
    ownerScopeId: workspaceId,
    derivedFromAgentId: source.id,
    name: source.name,
    description: source.description,
    avatarUrl: source.avatar_url,
    servers: source.servers,
    model: source.model,
    temperature: source.temperature,
    maxSteps: source.max_steps,
    systemPrompt: source.system_prompt,
    fewShotExamples: source.few_shot_examples,
    enabledTools: source.enabled_tools,
    skillIds: source.skill_ids,
    mode: source.mode,
  });

  return normaliseAgentResponse(published);
}
