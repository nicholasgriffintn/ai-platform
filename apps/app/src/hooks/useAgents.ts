import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateAgentInput, UpdateAgentInput } from "@assistant/schemas";
import { apiService } from "~/lib/api/api-service";
import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const AGENTS_QUERY_KEYS = {
	all: ["agents"],
} as const;

export type AgentData = Omit<CreateAgentInput, "avatar_url"> & Pick<UpdateAgentInput, "avatar_url">;

export function useAgents() {
	const queryClient = useQueryClient();
	const canAccessProFeatures = useCanAccessProFeatures();

	const agentsQuery = useQuery<any[]>({
		queryKey: AGENTS_QUERY_KEYS.all,
		queryFn: () => apiService.listAgents(),
		enabled: canAccessProFeatures,
		staleTime: 1000 * 60,
	});
	const agents = canAccessProFeatures ? (agentsQuery.data ?? []) : [];

	const createMutation = useMutation<any, Error, AgentData>({
		mutationFn: (data) => apiService.createAgent(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
		},
	});

	const updateMutation = useMutation<any, Error, { id: string; data: UpdateAgentInput }>({
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
					name: agent.team_id.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
					orchestrator: null,
					members: [],
				};
			}

			if (agent.team_role === "orchestrator") {
				acc.teams[agent.team_id].orchestrator = agent;
				acc.teams[agent.team_id].name =
					agent.name.replace(/orchestrator/i, "").trim() || acc.teams[agent.team_id].name;
			} else {
				acc.teams[agent.team_id]?.members.push(agent);
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
		isLoadingAgents: canAccessProFeatures ? agentsQuery.isLoading : false,
		errorAgents: canAccessProFeatures ? agentsQuery.error : null,
		createAgent: createMutation.mutateAsync,
		isCreatingAgent: createMutation.isPending,
		updateAgent: updateMutation.mutateAsync,
		isUpdatingAgent: updateMutation.isPending,
		deleteAgent: deleteMutation.mutate,
		isDeletingAgent: deleteMutation.isPending,
	};
}
