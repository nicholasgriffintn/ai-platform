import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AgentResponse,
  CreateAgentInput,
  SharedAgentSummary,
  UpdateAgentInput,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper";

export class AgentService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async listAgents(): Promise<AgentResponse[]> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for listAgents:", error);
    }

    const response = await fetchApi("/agents", { method: "GET", headers });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to list agents: ${response.statusText}`,
      );
    }

    const responseData = await returnFetchedData<AgentResponse[]>(response);

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
  } = {}): Promise<SharedAgentSummary[]> {
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

    const responseData = await returnFetchedData<SharedAgentSummary[]>(response);

    return responseData || [];
  }

  async listFeaturedSharedAgents(limit = 10): Promise<SharedAgentSummary[]> {
    const params = new URLSearchParams();

    params.append("limit", String(limit));
    const response = await fetchApi(`/agents/shared/featured?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to list featured agents: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<SharedAgentSummary[]>(response);

    return responseData || [];
  }

  async installSharedAgent(agentId: string): Promise<unknown> {
    const response = await fetchApi(`/agents/shared/${agentId}/install`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Failed to install shared agent: ${response.statusText}`);
    }

    return returnFetchedData<unknown>(response);
  }

  async shareAgent(
    agentId: string,
    name: string,
    description?: string | null,
    avatarUrl?: string | null,
    category?: string | null,
    tags?: string[] | null,
  ): Promise<unknown> {
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

    return returnFetchedData<unknown>(response);
  }

  async rateSharedAgent(agentId: string, rating: number, review?: string): Promise<unknown> {
    const body = { rating, review };
    const response = await fetchApi(`/agents/shared/${agentId}/rate`, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to rate shared agent: ${response.statusText}`);
    }

    return returnFetchedData<unknown>(response);
  }

  async getAgentRatings(agentId: string, limit = 10): Promise<unknown[]> {
    const params = new URLSearchParams();

    params.append("limit", String(limit));
    const response = await fetchApi(`/agents/shared/${agentId}/ratings?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get agent ratings: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<unknown[]>(response);

    return responseData || [];
  }

  async getSharedCategories(): Promise<string[]> {
    const response = await fetchApi(`/agents/shared/categories`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get shared agent categories: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<string[]>(response);

    return responseData || [];
  }

  async getSharedTags(): Promise<string[]> {
    const response = await fetchApi(`/agents/shared/tags`, { method: "GET" });

    if (!response.ok) {
      throw new Error(`Failed to get shared agent tags: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<string[]>(response);

    return responseData || [];
  }

  async createAgent(data: CreateAgentInput): Promise<AgentResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for createAgent:", error);
    }

    const body = {
      name: data.name,
      description: data.description || undefined,
      avatar_url: data.avatar_url || undefined,
      servers: data.servers || undefined,
      model: data.model || undefined,
      temperature: data.temperature !== undefined ? data.temperature : undefined,
      max_steps: data.max_steps !== undefined ? data.max_steps : undefined,
      system_prompt: data.system_prompt || undefined,
      few_shot_examples: data.few_shot_examples || undefined,
      enabled_tools: data.enabled_tools || undefined,
    };

    const response = await fetchApi("/agents", {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }

    return returnFetchedData<AgentResponse>(response);
  }

  async updateAgent(agentId: string, data: UpdateAgentInput): Promise<AgentResponse> {
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
      temperature: data.temperature !== undefined ? data.temperature : undefined,
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

    return returnFetchedData<AgentResponse>(response);
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

    await returnFetchedData<unknown>(response);
  }
}
