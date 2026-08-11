import { fetchProviderJson } from "~/lib/providers/lib/fetch";
import { getRecipeConnectorAccessToken } from "~/services/apps/connectors";
import { SourceRepository, type SourceRecord } from "~/repositories/SourceRepository";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser, IUserSettings } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";
import { appendUrlPath } from "~/utils/urls";
import type {
	MemoryProvider,
	MemoryProviderCapabilities,
	MemoryRetrieveOptions,
	MemoryRetrieveResult,
	MemoryStoreInput,
	MemoryStoreResult,
} from "./types";

export type MemoryConnectorProvider = "hindsight" | "honcho";

export interface BaseMemoryProviderConfig {
	env: IEnv;
	user?: IUser;
	userSettings?: IUserSettings | null;
	serviceContext?: ServiceContext;
	baseUrl?: string;
	connectorProvider?: MemoryConnectorProvider;
}

export abstract class BaseMemoryProvider implements MemoryProvider {
	abstract readonly name: MemoryProvider["name"];
	abstract readonly capabilities: MemoryProviderCapabilities;

	protected constructor(protected readonly config: BaseMemoryProviderConfig) {}

	abstract storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult>;
	abstract retrieveMemories(
		query: string,
		options?: MemoryRetrieveOptions,
	): Promise<MemoryRetrieveResult[]>;
	abstract deleteMemory(memoryId: string): Promise<boolean>;

	protected get env(): IEnv {
		return this.config.env;
	}

	protected get user(): IUser | undefined {
		return this.config.user;
	}

	protected get userSettings(): IUserSettings | null | undefined {
		return this.config.userSettings;
	}

	protected async getConnectorApiKey(provider = this.config.connectorProvider): Promise<string> {
		if (!provider) {
			throw new AssistantError(
				`${this.name} memory provider does not declare a connector provider`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		if (!this.config.serviceContext || !this.config.user?.id) {
			throw new AssistantError(
				"External memory providers require a signed-in user and service context",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const token = await getRecipeConnectorAccessToken({
			context: this.config.serviceContext,
			userId: this.config.user.id,
			provider,
		});

		return token.accessToken;
	}

	protected async fetchJson<T>(
		path: string,
		options: {
			method?: string;
			apiKey?: string;
			body?: unknown;
			allowNullResponse?: boolean;
		} = {},
	): Promise<T> {
		if (!this.config.baseUrl) {
			throw new AssistantError(
				`${this.name} memory provider requires a base URL`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return fetchProviderJson<T>(this.name, appendUrlPath(this.config.baseUrl, path), options);
	}

	protected async createLocalMemory(
		input: MemoryStoreInput,
		vectorId: string,
	): Promise<string | null> {
		if (!this.config.user?.id) {
			return null;
		}

		const repository = this.getSourceRepository();
		const memory = await repository.createSource({
			createdByUserId: this.config.user.id,
			conversationId: input.conversationId,
			kind: "memory",
			title: input.text.slice(0, 120) || "Memory",
			content: input.text,
			vectorId,
			metadata: {
				...input.metadata,
				category: input.metadata.category || "general",
				memory_provider: this.name,
				external_id: vectorId,
				stored_at: Date.now().toString(),
			},
		});

		return memory?.id ?? null;
	}

	protected async getLocalMemoryForDelete(memoryId: string): Promise<{
		memory: SourceRecord;
		vectorId?: string;
	} | null> {
		if (!this.config.user?.id) {
			throw new AssistantError(
				"User ID is required to delete memories",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const repository = this.getSourceRepository();
		const memory = await repository.getSource(memoryId);
		if (
			!memory ||
			memory.kind !== "memory" ||
			memory.created_by_user_id !== this.config.user.id ||
			memory.project_id
		) {
			return null;
		}

		const metadata =
			typeof memory.metadata === "string" ? safeParseJson(memory.metadata) : memory.metadata;
		const vectorId =
			typeof memory.vector_id === "string" && memory.vector_id
				? memory.vector_id
				: isRecord(metadata) && typeof metadata.external_id === "string"
					? metadata.external_id
					: undefined;

		return { memory, vectorId };
	}

	protected async removeLocalMemory(memoryId: string): Promise<void> {
		const repository = this.getSourceRepository();
		await repository.removeSourceFromCollections(memoryId);
		await repository.deleteSource(memoryId);
	}

	private getSourceRepository(): SourceRepository {
		return (
			this.config.serviceContext?.repositories.sources ?? new SourceRepository(this.config.env)
		);
	}

	protected getUserTag(): string | undefined {
		return this.config.user?.id ? `user:${this.config.user.id}` : undefined;
	}

	protected createProviderRecordId(prefix: string): string {
		return `${prefix}_${generateId().replace(/[^a-zA-Z0-9_-]/g, "_")}`;
	}
}
