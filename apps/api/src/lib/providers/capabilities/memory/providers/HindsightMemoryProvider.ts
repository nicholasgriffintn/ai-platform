import type {
	MemoryProviderCapabilities,
	MemoryRetrieveOptions,
	MemoryRetrieveResult,
	MemoryStoreInput,
	MemoryStoreResult,
} from "../types";
import { BaseMemoryProvider, type BaseMemoryProviderConfig } from "../base";

interface HindsightRecallResponse {
	results?: Array<{
		id?: string;
		text?: string;
		score?: number;
		type?: string;
	}>;
}

interface HindsightReflectResponse {
	text?: string;
	based_on?: {
		memories?: Array<{
			id?: string;
			text?: string;
			type?: string;
		}>;
	};
}

export class HindsightMemoryProvider extends BaseMemoryProvider {
	readonly name = "hindsight" as const;
	readonly capabilities: MemoryProviderCapabilities = {
		deduplication: true,
		reasoning: true,
		conversationIngestion: true,
		externalStorage: true,
	};

	constructor(config: Omit<BaseMemoryProviderConfig, "connectorProvider">) {
		super({ ...config, connectorProvider: "hindsight" });
	}

	async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
		const apiKey = await this.getConnectorApiKey();
		const externalId = this.createProviderRecordId("assistant_memory");
		const tags = [this.getUserTag(), `category:${input.metadata.category || "general"}`].filter(
			Boolean,
		);

		await this.fetchJson(`/v1/default/banks/${this.getBankId()}/memories`, {
			apiKey,
			body: {
				async: false,
				items: [
					{
						content: input.text,
						context: input.metadata.category || "assistant memory",
						document_id: externalId,
						timestamp: new Date().toISOString(),
						tags,
					},
				],
			},
		});

		const id = await this.createLocalMemory(input, externalId);
		return { id, provider: this.name, externalId };
	}

	async retrieveMemories(
		query: string,
		options: MemoryRetrieveOptions = {},
	): Promise<MemoryRetrieveResult[]> {
		const apiKey = await this.getConnectorApiKey();
		const topK = options.topK ?? 3;
		const tags = [this.getUserTag()].filter(Boolean);

		const reflected = await this.fetchJson<HindsightReflectResponse>(
			`/v1/default/banks/${this.getBankId()}/reflect`,
			{
				apiKey,
				body: {
					query,
					budget: "low",
					max_tokens: 1200,
					include: { facts: {} },
					tags,
					tags_match: "all_strict",
				},
			},
		).catch(() => null);

		if (reflected?.text) {
			return [
				{
					text: reflected.text,
					score: 1,
					metadata: {
						provider: this.name,
						sourceMemoryIds: reflected.based_on?.memories
							?.map((memory) => memory.id)
							.filter(Boolean),
					},
				},
			];
		}

		const recalled = await this.fetchJson<HindsightRecallResponse>(
			`/v1/default/banks/${this.getBankId()}/memories/recall`,
			{
				apiKey,
				body: {
					query,
					max_tokens: 1200,
					budget: "low",
					tags,
					tags_match: "all_strict",
					types: ["world", "experience", "observation"],
				},
			},
		);

		return (recalled.results ?? [])
			.filter((result) => typeof result.text === "string" && result.text.trim())
			.slice(0, topK)
			.map((result) => ({
				id: result.id,
				text: result.text!,
				score: result.score ?? 1,
				metadata: {
					provider: this.name,
					type: result.type,
				},
			}));
	}

	async deleteMemory(memoryId: string): Promise<boolean> {
		const { deleted, vectorId } = await this.deleteLocalMemory(memoryId);
		if (!deleted) {
			return false;
		}

		if (vectorId) {
			const apiKey = await this.getConnectorApiKey();
			await this.fetchJson(
				`/v1/default/banks/${this.getBankId()}/documents/${encodeURIComponent(vectorId)}`,
				{ apiKey, method: "DELETE", allowNullResponse: true },
			).catch(() => undefined);
		}

		return true;
	}

	private getBankId(): string {
		return this.config.user?.id ? `assistant_user_${this.config.user.id}` : "assistant_global";
	}
}
