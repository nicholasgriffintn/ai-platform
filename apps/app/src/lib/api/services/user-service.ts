import type { ModelConfig } from "~/types";
import { fetchApi } from "../fetch-wrapper";

export class UserService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async exportChatHistory(): Promise<Blob> {
		let headers = {} as Record<string, string>;
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error preparing headers for export:", error);
		}

		const response = await fetchApi("/user/export-chat-history", {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			let message = `Failed to export chat history: ${response.statusText}`;
			try {
				const data = (await response.json()) as any;
				if (
					data &&
					typeof data === "object" &&
					typeof data.error === "string"
				) {
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
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.statusText}`);
		}
		const responseData = (await response.json()) as any;

		return responseData.data;
	}

	async fetchTools(): Promise<any> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error fetching tools:", error);
		}

		const response = await fetchApi("/tools", {
			method: "GET",
			headers,
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch tools: ${response.statusText}`);
		}
		const responseData = (await response.json()) as any;

		return responseData;
	}

	async storeProviderApiKey(
		providerId: string,
		apiKey: string,
		secretKey?: string,
	): Promise<void> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error storing provider API key:", error);
		}

		const response = await fetchApi("/user/store-provider-api-key", {
			method: "POST",
			headers,
			body: {
				providerId,
				apiKey,
				secretKey,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to store provider API key: ${response.statusText}`,
			);
		}
	}

	async getProviderSettings(): Promise<{
		providers: Record<string, any>;
	}> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting provider settings:", error);
		}

		const response = await fetchApi("/user/providers", {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to get provider settings: ${response.statusText}`,
			);
		}

		return response.json();
	}

	async syncProviders(): Promise<void> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error syncing providers:", error);
		}

		const response = await fetchApi("/user/sync-providers", {
			method: "POST",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to sync providers: ${response.statusText}`);
		}
	}

	async getUserApiKeys(): Promise<
		{ id: string; name: string; created_at: string }[]
	> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting API keys:", error);
		}

		const response = await fetchApi("/user/api-keys", {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to get API keys: ${response.statusText}`);
		}
		return response.json();
	}

	async createApiKey(name?: string): Promise<{
		apiKey: string;
		id: string;
		name: string;
		created_at: string;
	}> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error creating API key:", error);
		}

		const response = await fetchApi("/user/api-keys", {
			method: "POST",
			headers,
			body: { name },
		});

		if (!response.ok) {
			const errorData = (await response
				.json()
				.catch(() => ({ error: response.statusText }))) as {
				error?: string;
			};
			const errorMessage = errorData?.error || response.statusText;
			throw new Error(`Failed to create API key: ${errorMessage}`);
		}
		return response.json();
	}

	async deleteApiKey(keyId: string): Promise<void> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error deleting API key:", error);
		}

		const response = await fetchApi(`/user/api-keys/${keyId}`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete API key: ${response.statusText}`);
		}
	}
}
