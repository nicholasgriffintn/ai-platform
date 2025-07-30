import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService } from "~/lib/api/api-service";

export const AGENTS_QUERY_KEYS = {
  all: ["agents"],
} as const;

export type AgentData = {
  name: string;
  description?: string;
  avatar_url?: string;
  servers?: any[];
  model?: string;
  temperature?: number;
  max_steps?: number;
  system_prompt?: string;
  few_shot_examples?: Array<{ input: string; output: string }>;
  team_id?: string;
  team_role?: string;
  is_team_agent?: boolean;
};

export function useAgents() {
  const queryClient = useQueryClient();

  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    error: errorAgents,
  } = useQuery<any[]>({
    queryKey: AGENTS_QUERY_KEYS.all,
    queryFn: () => apiService.listAgents(),
    staleTime: 1000 * 60,
  });

  const createMutation = useMutation<any, Error, AgentData>({
    mutationFn: ({
      name,
      description,
      avatar_url,
      servers,
      model,
      temperature,
      max_steps,
      system_prompt,
      few_shot_examples,
      team_id,
      team_role,
      is_team_agent,
    }) =>
      apiService.createAgent(
        name,
        servers,
        description,
        avatar_url,
        model,
        temperature,
        max_steps,
        system_prompt,
        few_shot_examples,
        team_id,
        team_role,
        is_team_agent,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const updateMutation = useMutation<
    any,
    Error,
    { id: string; data: Partial<AgentData> }
  >({
    mutationFn: ({ id, data }) => apiService.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (agentId) => apiService.deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const chatAgents = agents.filter(
    (agent: any) => !agent.is_team_agent || agent.team_role === "orchestrator",
  );

  const groupedAgents = agents.reduce((acc: any, agent: any) => {
    if (agent.is_team_agent && agent.team_id) {
      if (!acc.teams) acc.teams = {};
      if (!acc.teams[agent.team_id]) {
        acc.teams[agent.team_id] = {
          id: agent.team_id,
          name: agent.team_id
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase()),
          orchestrator: null,
          members: [],
        };
      }

      if (agent.team_role === "orchestrator") {
        acc.teams[agent.team_id].orchestrator = agent;
        acc.teams[agent.team_id].name =
          agent.name.replace(/orchestrator/i, "").trim() ||
          acc.teams[agent.team_id].name;
      } else {
        acc.teams[agent.team_id].members.push(agent);
      }
    } else {
      if (!acc.individual) acc.individual = [];
      acc.individual.push(agent);
    }
    return acc;
  }, {});

  return {
    agents,
    chatAgents,
    groupedAgents,
    isLoadingAgents,
    errorAgents,
    createAgent: createMutation.mutateAsync,
    isCreatingAgent: createMutation.isPending,
    updateAgent: updateMutation.mutateAsync,
    isUpdatingAgent: updateMutation.isPending,
    deleteAgent: deleteMutation.mutate,
    isDeletingAgent: deleteMutation.isPending,
  };
}
