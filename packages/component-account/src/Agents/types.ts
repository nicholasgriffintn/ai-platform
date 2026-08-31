import type { AgentResponse, CreateAgentInput } from "@ngriffin_uk/polychat-schemas";

export interface AgentTeam {
  id: string;
  name: string;
  orchestrator: AgentResponse | null;
  members: AgentResponse[];
}

export interface GroupedAgents {
  teams: Record<string, AgentTeam>;
  individual: AgentResponse[];
}

export type AgentFormData = Omit<CreateAgentInput, "avatar_url"> & {
  avatar_url?: string;
};
