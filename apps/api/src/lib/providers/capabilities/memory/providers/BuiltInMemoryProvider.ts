import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";
import type { IEnv, IUser, IUserSettings } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { BaseMemoryProvider } from "../base";
import type {
	MemoryProviderCapabilities,
	MemoryRetrieveOptions,
	MemoryRetrieveResult,
	MemoryStoreInput,
	MemoryStoreResult,
} from "../types";

const logger = getLogger({ prefix: "lib/providers/memory/built-in" });

export class BuiltInMemoryProvider extends BaseMemoryProvider {
	readonly name = "built-in" as const;
	readonly capabilities: MemoryProviderCapabilities = {
		deduplication: true,
		reasoning: false,
		conversationIngestion: false,
		externalStorage: false,
	};

	constructor(env: IEnv, user?: IUser, userSettings?: IUserSettings | null) {
		super({ env, user, userSettings });
	}

	async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
		const embedding = getEmbeddingProvider(
			this.env,
			this.user,
			input.userSettings ?? this.userSettings ?? undefined,
		);
		const vectorId = generateId();

		const vectors = await embedding.generate("memory", input.text, vectorId, {
			...input.metadata,
			text: input.text,
			stored_at: Date.now().toString(),
		});

		const namespace = this.getNamespace();
		const rawVec = vectors[0].values as number[];
		const candidateVector = new Float64Array(rawVec);
		const existing = await embedding.getMatches(candidateVector, {
			topK: 5,
			scoreThreshold: 0,
			namespace,
			returnMetadata: "all",
		});

		const hasSimilarMemory = (existing.matches || []).some(
			(match) => match.score >= 0.85 && match.metadata?.text,
		);

		if (hasSimilarMemory) {
			return { id: null, provider: this.name };
		}

		await embedding.insert(vectors, { namespace });
		const id = await this.createLocalMemory(input, vectorId);
		return { id, provider: this.name, externalId: vectorId };
	}

	async retrieveMemories(
		query: string,
		options: MemoryRetrieveOptions = {},
	): Promise<MemoryRetrieveResult[]> {
		const embedding = getEmbeddingProvider(
			this.env,
			this.user,
			options.userSettings ?? this.userSettings ?? undefined,
		);
		const topK = options.topK ?? 3;
		const scoreThreshold = options.scoreThreshold ?? 0.3;

		const queryEmb = await embedding.getQuery(query);
		const rawNumbers = queryEmb.data[0] as number[];
		const vector = new Float64Array(rawNumbers);

		const result = await embedding.getMatches(vector, {
			topK: Math.max(topK * 2, 10),
			scoreThreshold,
			namespace: this.getNamespace(),
			returnMetadata: "all",
		});

		return (result.matches || [])
			.filter((match) => match.score >= scoreThreshold && typeof match.metadata?.text === "string")
			.slice(0, topK)
			.map((match) => ({
				id: match.id,
				text: match.metadata.text as string,
				score: match.score,
				metadata: match.metadata,
			}));
	}

	async deleteMemory(memoryId: string): Promise<boolean> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to delete memories",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		try {
			const { deleted, vectorId } = await this.deleteLocalMemory(memoryId);
			if (!deleted) {
				logger.warn("Memory not found or access denied", {
					memoryId,
					userId: this.user.id,
				});
				return false;
			}

			if (vectorId) {
				const embedding = getEmbeddingProvider(this.env, this.user, this.userSettings ?? undefined);
				await embedding.delete([vectorId]);
			}

			return true;
		} catch (error) {
			logger.error("Failed to delete memory", { error, memoryId });
			return false;
		}
	}

	private getNamespace(): string {
		return `memory_user_${this.user?.id ?? "global"}`;
	}
}
