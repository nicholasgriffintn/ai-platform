import type {
	MemoryProviderCapabilities,
	MemoryRetrieveOptions,
	MemoryRetrieveResult,
	MemoryStoreInput,
	MemoryStoreResult,
} from "../types";
import { BaseMemoryProvider, type BaseMemoryProviderConfig } from "../base";

interface HonchoMessage {
	id: string;
	content: string;
	metadata?: Record<string, unknown>;
}

interface HonchoChatResponse {
	content?: string | null;
}

export class HonchoMemoryProvider extends BaseMemoryProvider {
	readonly name = "honcho" as const;
	readonly capabilities: MemoryProviderCapabilities = {
		deduplication: true,
		reasoning: true,
		conversationIngestion: true,
		externalStorage: true,
	};

	constructor(config: Omit<BaseMemoryProviderConfig, "connectorProvider">) {
		super({ ...config, connectorProvider: "honcho" });
	}

	async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
		const apiKey = await this.getConnectorApiKey();
		const workspaceId = this.getWorkspaceId();
		const peerId = this.getPeerId();
		const sessionId = this.getSessionId(input.conversationId);

		await this.ensureWorkspace(apiKey, workspaceId);
		await this.ensurePeer(apiKey, workspaceId, peerId);
		await this.ensureSession(apiKey, workspaceId, sessionId, peerId);

		const messages = await this.fetchJson<HonchoMessage[]>(
			`/v3/workspaces/${workspaceId}/sessions/${sessionId}/messages`,
			{
				apiKey,
				body: {
					messages: [
						{
							content: input.text,
							peer_id: peerId,
							metadata: {
								...input.metadata,
								source: "assistant_memory",
								category: input.metadata.category || "general",
							},
							created_at: new Date().toISOString(),
						},
					],
				},
			},
		);

		const externalId = messages[0]?.id ?? this.createProviderRecordId("honcho_message");
		const id = await this.createLocalMemory(input, externalId);
		return { id, provider: this.name, externalId };
	}

	async retrieveMemories(
		query: string,
		options: MemoryRetrieveOptions = {},
	): Promise<MemoryRetrieveResult[]> {
		const apiKey = await this.getConnectorApiKey();
		const workspaceId = this.getWorkspaceId();
		const peerId = this.getPeerId();

		await this.ensureWorkspace(apiKey, workspaceId);
		await this.ensurePeer(apiKey, workspaceId, peerId);

		const response = await this.fetchJson<HonchoChatResponse>(
			`/v3/workspaces/${workspaceId}/peers/${peerId}/chat`,
			{
				apiKey,
				body: {
					query,
					reasoning_level: "low",
					stream: false,
				},
			},
		);

		if (response.content?.trim()) {
			return [
				{
					text: response.content.trim(),
					score: 1,
					metadata: { provider: this.name, retrieval: "chat" },
				},
			];
		}

		const messages = await this.fetchJson<HonchoMessage[]>(
			`/v3/workspaces/${workspaceId}/peers/${peerId}/search`,
			{
				apiKey,
				body: {
					query,
					limit: options.topK ?? 3,
				},
			},
		);

		return messages.map((message) => ({
			id: message.id,
			text: message.content,
			score: 1,
			metadata: {
				...message.metadata,
				provider: this.name,
				retrieval: "search",
			},
		}));
	}

	async deleteMemory(_memoryId: string): Promise<boolean> {
		return false;
	}

	private async ensureWorkspace(apiKey: string, workspaceId: string): Promise<void> {
		await this.fetchJson("/v3/workspaces", {
			apiKey,
			body: {
				id: workspaceId,
				metadata: {
					source: "assistant",
				},
			},
		});
	}

	private async ensurePeer(apiKey: string, workspaceId: string, peerId: string): Promise<void> {
		await this.fetchJson(`/v3/workspaces/${workspaceId}/peers`, {
			apiKey,
			body: {
				id: peerId,
				metadata: {
					source: "assistant_user",
				},
			},
		});
	}

	private async ensureSession(
		apiKey: string,
		workspaceId: string,
		sessionId: string,
		peerId: string,
	): Promise<void> {
		await this.fetchJson(`/v3/workspaces/${workspaceId}/sessions`, {
			apiKey,
			body: {
				id: sessionId,
				metadata: {
					source: "assistant_conversation",
				},
				peers: {
					[peerId]: {
						observe_me: true,
						observe_others: false,
					},
				},
			},
		});
	}

	private getWorkspaceId(): string {
		return this.config.user?.id ? `assistant_user_${this.config.user.id}` : "assistant_global";
	}

	private getPeerId(): string {
		return this.config.user?.id ? `user_${this.config.user.id}` : "global_user";
	}

	private getSessionId(conversationId?: string): string {
		const source = conversationId?.trim() || "memories";
		return source.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 512) || "memories";
	}
}
