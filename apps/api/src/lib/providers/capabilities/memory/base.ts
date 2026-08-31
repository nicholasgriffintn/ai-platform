import type { SourceStatus } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { EmbeddingProviderTarget } from "~/lib/providers/capabilities/embedding/helpers";
import { fetchProviderJson } from "~/lib/providers/lib/fetch";
import { SourceRepository, type SourceRecord } from "~/repositories/SourceRepository";
import { getRecipeConnectorAccessToken } from "~/services/apps/connectors";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";
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
  memoryScope?: MemoryScope;
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

  protected get memoryScope(): MemoryScope {
    return this.config.memoryScope ?? { type: "personal" };
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
    embeddingTarget?: EmbeddingProviderTarget,
    status: SourceStatus = "available",
  ): Promise<string | null> {
    if (!this.config.user?.id) {
      return null;
    }

    const repository = this.getSourceRepository();
    const memory = await repository.createSource({
      createdByUserId: this.config.user.id,
      projectId: this.memoryScope.type === "project" ? this.memoryScope.projectId : undefined,
      conversationId: input.conversationId,
      kind: "memory",
      title: input.text.slice(0, 120) || "Memory",
      status,
      content: input.text,
      provider: this.name,
      vectorId,
      metadata: {
        ...input.metadata,
        category: input.metadata.category || "general",
        memory_provider: this.name,
        external_id: vectorId,
        ...(embeddingTarget ? { embedding_provider_target: embeddingTarget } : {}),
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
    const belongsToScope =
      this.memoryScope.type === "project"
        ? memory?.project_id === this.memoryScope.projectId
        : memory?.created_by_user_id === this.config.user.id && !memory?.project_id;

    if (!memory || memory.kind !== "memory" || !belongsToScope) {
      return null;
    }

    const metadata =
      typeof memory.metadata === "string" ? safeParseJson(memory.metadata) : memory.metadata;
    const vectorId = this.getLocalMemoryVectorId(memory, metadata);

    return { memory, vectorId };
  }

  protected async getScopedLocalMemoryByVectorId(vectorId: string): Promise<SourceRecord | null> {
    const memory = await this.getSourceRepository().getSourceByVectorId(vectorId);
    const belongsToScope =
      this.memoryScope.type === "project"
        ? memory?.project_id === this.memoryScope.projectId
        : memory?.created_by_user_id === this.config.user?.id && !memory?.project_id;

    return memory?.kind === "memory" && memory.status === "available" && belongsToScope
      ? memory
      : null;
  }

  protected async listActiveScopedLocalMemories(): Promise<SourceRecord[]> {
    if (!this.config.user?.id) {
      throw new AssistantError(
        "User ID is required to retrieve memories",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const repository = this.getSourceRepository();
    const memories =
      this.memoryScope.type === "project"
        ? await repository.listProjectSources(this.memoryScope.projectId, "memory")
        : await repository.listPersonalSources(this.config.user.id, "memory");

    return memories.filter((memory) => memory.kind === "memory" && memory.status === "available");
  }

  protected getLocalMemoryVectorId(
    memory: SourceRecord,
    parsedMetadata?: unknown,
  ): string | undefined {
    if (typeof memory.vector_id === "string" && memory.vector_id) {
      return memory.vector_id;
    }

    const metadata =
      parsedMetadata ??
      (typeof memory.metadata === "string" ? safeParseJson(memory.metadata) : memory.metadata);

    return isRecord(metadata) && typeof metadata.external_id === "string"
      ? metadata.external_id
      : undefined;
  }

  protected getLocalMemoryEmbeddingTarget(memory: SourceRecord): EmbeddingProviderTarget | null {
    const metadata =
      typeof memory.metadata === "string" ? safeParseJson(memory.metadata) : memory.metadata;

    if (!isRecord(metadata) || metadata.embedding_provider_target === undefined) {
      return null;
    }

    if (!isRecord(metadata.embedding_provider_target)) {
      throw new AssistantError(
        "Stored memory embedding target is invalid",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const target = metadata.embedding_provider_target;

    if (
      typeof target.provider !== "string" ||
      typeof target.target !== "string" ||
      typeof target.model !== "string" ||
      typeof target.vectorSpace !== "string" ||
      typeof target.vectorSpaceVersion !== "string" ||
      !target.provider ||
      !target.target ||
      !target.model ||
      !target.vectorSpace ||
      !target.vectorSpaceVersion
    ) {
      throw new AssistantError(
        "Stored memory embedding target is invalid",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return {
      provider: target.provider,
      target: target.target,
      model: target.model,
      vectorSpace: target.vectorSpace,
      vectorSpaceVersion: target.vectorSpaceVersion,
    };
  }

  protected async transitionLocalMemoryStatus(
    memoryId: string,
    expectedStatuses: SourceStatus[],
    status: SourceStatus,
  ): Promise<boolean> {
    return this.getSourceRepository().transitionSourceStatus(memoryId, expectedStatuses, status);
  }

  protected async removeLocalMemory(memoryId: string): Promise<void> {
    const repository = this.getSourceRepository();

    await repository.removeSourceFromCollections(memoryId);
    await repository.deleteSource(memoryId);
  }

  protected getSourceRepository(): SourceRepository {
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
