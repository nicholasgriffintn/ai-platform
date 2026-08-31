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

function toAgentPayload(data: CreateAgentInput | UpdateAgentInput) {
  return {
    name: data.name,
    description: data.description,
    avatar_url: data.avatar_url || undefined,
    servers: data.servers,
    model: data.model,
    temperature: data.temperature,
    max_steps: data.max_steps,
    system_prompt: data.system_prompt,
    few_shot_examples: data.few_shot_examples,
    enabled_tools: data.enabled_tools,
    skill_ids: data.skill_ids,
    mode: data.mode,
  };
}

export class AgentService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  private async authHeaders(operation: string): Promise<Record<string, string>> {
    try {
      return await this.getHeaders();
    } catch (error) {
      console.error(`Error getting headers for ${operation}:`, error);

      return {};
    }
  }

  async getAgent(agentId: string): Promise<AgentResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for getAgent:", error);
    }

    const response = await fetchApi(`/agents/${agentId}`, { method: "GET", headers });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to load agent: ${response.statusText}`,
      );
    }

    return returnFetchedData<AgentResponse>(response);
  }

  async publishAgentToWorkspace(agentId: string, workspaceId: string): Promise<AgentResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for publishAgentToWorkspace:", error);
    }

    const response = await fetchApi(`/agents/${agentId}/publish/workspace`, {
      method: "POST",
      headers,
      body: { workspace_id: workspaceId },
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to publish agent: ${response.statusText}`,
      );
    }

    return returnFetchedData<AgentResponse>(response);
  }

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

  async installSharedAgent(sharedAgentId: string): Promise<unknown> {
    const response = await fetchApi(`/agents/shared/${sharedAgentId}/install`, {
      method: "POST",
      headers: await this.authHeaders("installSharedAgent"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to install shared agent: ${response.statusText}`,
      );
    }

    return returnFetchedData<unknown>(response);
  }

  async getSharedAgentListingForAgent(agentId: string): Promise<SharedAgentSummary | null> {
    const response = await fetchApi(`/agents/shared/check/${agentId}`, {
      method: "GET",
      headers: await this.authHeaders("getSharedAgentListingForAgent"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to check agent sharing: ${response.statusText}`,
      );
    }

    const responseData = await returnFetchedData<{
      isShared: boolean;
      sharedAgent: SharedAgentSummary | null;
    }>(response);

    return responseData?.sharedAgent ?? null;
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
      headers: await this.authHeaders("shareAgent"),
      body,
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to share agent: ${response.statusText}`,
      );
    }

    return returnFetchedData<unknown>(response);
  }

  async unshareAgent(sharedAgentId: string): Promise<void> {
    const response = await fetchApi(`/agents/shared/${sharedAgentId}`, {
      method: "DELETE",
      headers: await this.authHeaders("unshareAgent"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to stop sharing agent: ${response.statusText}`,
      );
    }

    await returnFetchedData<unknown>(response);
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

    const response = await fetchApi("/agents", {
      method: "POST",
      headers,
      body: toAgentPayload(data),
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

    const response = await fetchApi(`/agents/${agentId}`, {
      method: "PUT",
      headers,
      body: toAgentPayload(data),
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
