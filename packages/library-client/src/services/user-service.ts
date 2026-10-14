import {
  decodeModelList,
  type ModelConfig,
  type ListPage,
  type ModelTiersResponse,
  type ProviderSyncStatus,
  type Tool,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { returnFetchedData } from "../http.js";
import { withProjectScope, withWorkspaceScope } from "../project-scope.js";
import { requestJson, resource } from "../resource.js";

export interface ProviderSetting {
  id: string;
  provider_id: string;
  name?: string;
  description?: string;
  type?: string;
  configurationFields?: Array<{
    key: string;
    label: string;
    type: "text" | "password";
    required?: boolean;
    placeholder?: string;
    description?: string;
  }>;
  configurationValues?: Record<string, string>;
  webhookUrl?: string;
  enabled: boolean;
  hasApiKey?: boolean;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  created_at: string;
}

const PROVIDER_TIMEOUT_MS = 10000;
const providers = resource<ProviderSetting>("/providers");
const apiKeys = resource<ApiKeySummary>("/api_keys");

export class UserService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async exportChatHistory(): Promise<Blob> {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error preparing headers for export:", error);
    }

    const response = await fetchApi("/account/export", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      let message = `Failed to export chat history: ${response.statusText}`;

      try {
        const data = await returnFetchedData<any>(response);

        if (data && typeof data === "object" && typeof data.error === "string") {
          message = data.error;
        }
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();

    return blob;
  }

  async fetchModels(): Promise<ModelConfig> {
    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error fetching models:", error);
    }

    const response = await fetchApi("/models", {
      method: "GET",
      cache: "no-store",
      headers,
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const responseData = await returnFetchedData<unknown>(response);

    return decodeModelList(responseData);
  }

  async fetchModelTiers(): Promise<ModelTiersResponse> {
    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error fetching model tiers:", error);
    }

    const response = await fetchApi("/models/tiers", {
      method: "GET",
      headers,
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch model tiers: ${response.statusText}`);
    }

    return returnFetchedData<ModelTiersResponse>(response);
  }

  async fetchModelCatalogue(): Promise<ModelConfig> {
    const response = await fetchApi("/models/catalogue", {
      method: "GET",
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch model catalogue: ${response.statusText}`);
    }

    return decodeModelList(await returnFetchedData<unknown>(response));
  }

  async fetchTools(projectId?: string, workspaceId?: string): Promise<Tool[]> {
    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error fetching tools:", error);
    }

    const response = await fetchApi(
      withWorkspaceScope(withProjectScope("/tools", projectId), workspaceId),
      {
        method: "GET",
        headers,
        timeoutMs: 10000,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`);
    }

    return (await returnFetchedData<ListPage<Tool>>(response)).data;
  }

  async storeProviderApiKey(
    providerId: string,
    apiKey: string,
    secretKey?: string,
    configuration?: Record<string, unknown>,
  ): Promise<void> {
    await requestJson<unknown>(
      `${providers.path}/${encodeURIComponent(providerId)}`,
      "PATCH",
      { apiKey, secretKey, configuration },
      { timeoutMs: PROVIDER_TIMEOUT_MS },
    );
  }

  async getProviders(): Promise<{
    settings: ProviderSetting[];
    syncStatus: ProviderSyncStatus;
  }> {
    const page = await requestJson<ListPage<ProviderSetting> & { sync_status: ProviderSyncStatus }>(
      "/providers",
      "GET",
    );

    return { settings: page.data, syncStatus: page.sync_status };
  }

  deleteProviderApiKey(providerId: string): Promise<void> {
    return providers.delete(providerId);
  }

  async syncProviders(): Promise<void> {
    await providers.collectionAction("sync");
  }

  getUserApiKeys(): Promise<ApiKeySummary[]> {
    return apiKeys.listAll();
  }

  createApiKey(name?: string): Promise<ApiKeySummary & { apiKey: string }> {
    return requestJson<ApiKeySummary & { apiKey: string }>(apiKeys.path, "POST", { name });
  }

  deleteApiKey(keyId: string): Promise<void> {
    return apiKeys.delete(keyId);
  }
}
