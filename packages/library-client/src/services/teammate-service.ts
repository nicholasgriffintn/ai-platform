import type {
  TeammateResponse,
  CreateTeammateInput,
  HireTeammateInput,
  SharedTeammateSummary,
  UpdateTeammateInput,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "../http.js";

function toTeammatePayload(data: CreateTeammateInput | UpdateTeammateInput) {
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
    kind: data.kind,
  };
}

export class TeammateService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  private async authHeaders(operation: string): Promise<Record<string, string>> {
    try {
      return await this.getHeaders();
    } catch (error) {
      console.error(`Error getting headers for ${operation}:`, error);

      return {};
    }
  }

  async getTeammate(teammateId: string): Promise<TeammateResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for getTeammate:", error);
    }

    const response = await fetchApi(`/teammates/${teammateId}`, { method: "GET", headers });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to load teammate: ${response.statusText}`,
      );
    }

    return returnFetchedData<TeammateResponse>(response);
  }

  async publishTeammateToWorkspace(
    teammateId: string,
    workspaceId: string,
  ): Promise<TeammateResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for publishTeammateToWorkspace:", error);
    }

    const response = await fetchApi(`/teammates/${teammateId}/publish/workspace`, {
      method: "POST",
      headers,
      body: { workspace_id: workspaceId },
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to publish teammate: ${response.statusText}`,
      );
    }

    return returnFetchedData<TeammateResponse>(response);
  }

  async listTeammates(): Promise<TeammateResponse[]> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for listTeammates:", error);
    }

    const response = await fetchApi("/teammates", { method: "GET", headers });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to list teammates: ${response.statusText}`,
      );
    }

    const responseData = await returnFetchedData<TeammateResponse[]>(response);

    return responseData || [];
  }

  async listSharedTeammates({
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
  } = {}): Promise<SharedTeammateSummary[]> {
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

    const response = await fetchApi(`/teammates/shared?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to list shared teammates: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<SharedTeammateSummary[]>(response);

    return responseData || [];
  }

  async listFeaturedSharedTeammates(limit = 10): Promise<SharedTeammateSummary[]> {
    const params = new URLSearchParams();

    params.append("limit", String(limit));
    const response = await fetchApi(`/teammates/shared/featured?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to list featured teammates: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<SharedTeammateSummary[]>(response);

    return responseData || [];
  }

  async installSharedTeammate(sharedTeammateId: string): Promise<unknown> {
    const response = await fetchApi(`/teammates/shared/${sharedTeammateId}/install`, {
      method: "POST",
      headers: await this.authHeaders("installSharedTeammate"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to install shared teammate: ${response.statusText}`,
      );
    }

    return returnFetchedData<unknown>(response);
  }

  async getSharedTeammateListingForTeammate(
    teammateId: string,
  ): Promise<SharedTeammateSummary | null> {
    const response = await fetchApi(`/teammates/shared/check/${teammateId}`, {
      method: "GET",
      headers: await this.authHeaders("getSharedTeammateListingForTeammate"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to check teammate sharing: ${response.statusText}`,
      );
    }

    const responseData = await returnFetchedData<{
      isShared: boolean;
      sharedTeammate: SharedTeammateSummary | null;
    }>(response);

    return responseData?.sharedTeammate ?? null;
  }

  async shareTeammate(
    teammateId: string,
    name: string,
    description?: string | null,
    avatarUrl?: string | null,
    category?: string | null,
    tags?: string[] | null,
  ): Promise<unknown> {
    const body = {
      agent_id: teammateId,
      name,
      description,
      avatar_url: avatarUrl,
      category,
      tags,
    };
    const response = await fetchApi(`/teammates/shared/share`, {
      method: "POST",
      headers: await this.authHeaders("shareTeammate"),
      body,
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to share teammate: ${response.statusText}`,
      );
    }

    return returnFetchedData<unknown>(response);
  }

  async unshareTeammate(sharedTeammateId: string): Promise<void> {
    const response = await fetchApi(`/teammates/shared/${sharedTeammateId}`, {
      method: "DELETE",
      headers: await this.authHeaders("unshareTeammate"),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to stop sharing teammate: ${response.statusText}`,
      );
    }

    await returnFetchedData<unknown>(response);
  }

  async getSharedCategories(): Promise<string[]> {
    const response = await fetchApi(`/teammates/shared/categories`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get shared teammate categories: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<string[]>(response);

    return responseData || [];
  }

  async getSharedTags(): Promise<string[]> {
    const response = await fetchApi(`/teammates/shared/tags`, { method: "GET" });

    if (!response.ok) {
      throw new Error(`Failed to get shared teammate tags: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<string[]>(response);

    return responseData || [];
  }

  async createTeammate(data: CreateTeammateInput): Promise<TeammateResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for createTeammate:", error);
    }

    const response = await fetchApi("/teammates", {
      method: "POST",
      headers,
      body: toTeammatePayload(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create teammate: ${response.statusText}`);
    }

    return returnFetchedData<TeammateResponse>(response);
  }

  async hireTeammate(data: HireTeammateInput): Promise<TeammateResponse> {
    const headers = await this.authHeaders("hireTeammate");
    const response = await fetchApi("/teammates/hire", { method: "POST", headers, body: data });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to hire teammate: ${response.statusText}`,
      );
    }

    return returnFetchedData<TeammateResponse>(response);
  }

  async updateTeammate(teammateId: string, data: UpdateTeammateInput): Promise<TeammateResponse> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for updateTeammate:", error);
    }

    const response = await fetchApi(`/teammates/${teammateId}`, {
      method: "PUT",
      headers,
      body: toTeammatePayload(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update teammate: ${response.statusText}`);
    }

    return returnFetchedData<TeammateResponse>(response);
  }

  async deleteTeammate(teammateId: string): Promise<void> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for deleteTeammate:", error);
    }

    const response = await fetchApi(`/teammates/${teammateId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete teammate: ${response.statusText}`);
    }

    await returnFetchedData<unknown>(response);
  }
}
