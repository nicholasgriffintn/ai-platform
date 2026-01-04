import { fetchApi, returnFetchedData } from "../fetch-wrapper";

export class AgentService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async listAgents(): Promise<any[]> {
		let headers: Record<string, string> = {};

		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting headers for listAgents:", error);
		}

		const response = await fetchApi("/agents", { method: "GET", headers });

		if (!response.ok) {
			throw new Error(`Failed to list agents: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async listSharedAgents({
		category,
		tags,
		search,
		featured,
		limit,
		offset,
		sort_by,
	}: {
		category?: string;
		tags?: string[];
		search?: string;
		featured?: boolean;
		limit?: number;
		offset?: number;
		sort_by?: string;
	} = {}): Promise<any[]> {
		const params = new URLSearchParams();

		if (category) {
			params.append("category", category);
		}

		if (tags?.length) {
			tags.forEach((tag) => params.append("tags", tag));
		}

		if (search) {
			params.append("search", search);
		}

		if (featured !== undefined) {
			params.append("featured", String(featured));
		}

		if (limit !== undefined) {
			params.append("limit", String(limit));
		}

		if (offset !== undefined) {
			params.append("offset", String(offset));
		}

		if (sort_by) {
			params.append("sort_by", sort_by);
		}

		const response = await fetchApi(`/agents/shared?${params.toString()}`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`Failed to list shared agents: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async listFeaturedSharedAgents(limit = 10): Promise<any[]> {
		const params = new URLSearchParams();
		params.append("limit", String(limit));
		const response = await fetchApi(
			`/agents/shared/featured?${params.toString()}`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list featured agents: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async installSharedAgent(agentId: string): Promise<any> {
		const response = await fetchApi(`/agents/shared/${agentId}/install`, {
			method: "POST",
		});

		if (!response.ok) {
			throw new Error(`Failed to install shared agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async shareAgent(
		agentId: string,
		name: string,
		description?: string | null,
		avatarUrl?: string | null,
		category?: string | null,
		tags?: string[] | null,
	): Promise<any> {
		const body = {
			agent_id: agentId,
			name,
			description,
			avatar_url: avatarUrl,
			category,
			tags,
		};
		const response = await fetchApi(`/agents/shared/share`, {
			method: "POST",
			body,
		});

		if (!response.ok) {
			throw new Error(`Failed to share agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async rateSharedAgent(
		agentId: string,
		rating: number,
		review?: string,
	): Promise<any> {
		const body = { rating, review };
		const response = await fetchApi(`/agents/shared/${agentId}/rate`, {
			method: "POST",
			body,
		});

		if (!response.ok) {
			throw new Error(`Failed to rate shared agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async getAgentRatings(agentId: string, limit = 10): Promise<any[]> {
		const params = new URLSearchParams();
		params.append("limit", String(limit));
		const response = await fetchApi(
			`/agents/shared/${agentId}/ratings?${params.toString()}`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to get agent ratings: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async getSharedCategories(): Promise<string[]> {
		const response = await fetchApi(`/agents/shared/categories`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(
				`Failed to get shared agent categories: ${response.statusText}`,
			);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async getSharedTags(): Promise<string[]> {
		const response = await fetchApi(`/agents/shared/tags`, { method: "GET" });

		if (!response.ok) {
			throw new Error(
				`Failed to get shared agent tags: ${response.statusText}`,
			);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async createAgent(
		name: string,
		servers?: any[],
		description?: string | null,
		avatarUrl?: string | null,
		model?: string | null,
		temperature?: number | null,
		maxSteps?: number | null,
		systemPrompt?: string | null,
		fewShotExamples?: any[] | null,
		enabledTools?: string[] | null,
		teamId?: string | null,
		teamRole?: string | null,
		isTeamAgent?: boolean | null,
	): Promise<any> {
		let headers: Record<string, string> = {};

		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting headers for createAgent:", error);
		}

		const body = {
			name,
			description: description || undefined,
			avatar_url: avatarUrl || undefined,
			servers: servers || undefined,
			model: model || undefined,
			temperature: temperature !== undefined ? temperature : undefined,
			max_steps: maxSteps !== undefined ? maxSteps : undefined,
			system_prompt: systemPrompt || undefined,
			few_shot_examples: fewShotExamples || undefined,
			enabled_tools: enabledTools || undefined,
			team_id: teamId || undefined,
			team_role: teamRole || undefined,
			is_team_agent: isTeamAgent ? isTeamAgent : undefined,
		};

		const response = await fetchApi("/agents", {
			method: "POST",
			headers,
			body,
		});

		if (!response.ok) {
			throw new Error(`Failed to create agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async updateAgent(
		agentId: string,
		data: Partial<{
			name: string;
			description: string;
			avatar_url: string;
			servers: any[];
			model: string;
			temperature: number;
			max_steps: number;
			system_prompt: string;
			few_shot_examples: Array<{ input: string; output: string }>;
			enabled_tools: string[];
		}>,
	): Promise<void> {
		let headers: Record<string, string> = {};

		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting headers for updateAgent:", error);
		}

		const body = {
			name: data.name || undefined,
			description: data.description || undefined,
			avatar_url: data.avatar_url || undefined,
			servers: data.servers || undefined,
			model: data.model || undefined,
			temperature:
				data.temperature !== undefined ? data.temperature : undefined,
			max_steps: data.max_steps !== undefined ? data.max_steps : undefined,
			system_prompt: data.system_prompt || undefined,
			few_shot_examples: data.few_shot_examples || undefined,
			enabled_tools: data.enabled_tools || undefined,
		};

		const response = await fetchApi(`/agents/${agentId}`, {
			method: "PUT",
			headers,
			body,
		});

		if (!response.ok) {
			throw new Error(`Failed to update agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}

	async deleteAgent(agentId: string): Promise<void> {
		let headers: Record<string, string> = {};

		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting headers for deleteAgent:", error);
		}

		const response = await fetchApi(`/agents/${agentId}`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete agent: ${response.statusText}`);
		}

		const responseData = await returnFetchedData<any>(response);

		return responseData || [];
	}
}
