import type { Agent } from "~/lib/database/schema";

export type AgentResponse = Omit<Agent, "temperature"> & {
	temperature: number | null;
};

export function normaliseAgentResponse(agent: Agent): AgentResponse {
	const temperature = agent.temperature === null ? null : Number(agent.temperature);

	return {
		...agent,
		temperature: Number.isFinite(temperature) ? temperature : null,
	};
}
