import type { AgentResponse, AssistantActionAgentSource } from "@ngriffin_uk/polychat-schemas";

export function toAssistantActionAgentSources(
  agents: readonly AgentResponse[],
): AssistantActionAgentSource[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    ...(agent.description ? { description: agent.description } : {}),
    ...(agent.model ? { model: agent.model } : {}),
  }));
}
