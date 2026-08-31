import type { CreateAgentInput } from "@ngriffin_uk/polychat-schemas";

export type AgentFormData = Omit<CreateAgentInput, "avatar_url"> & {
  avatar_url?: string;
};
