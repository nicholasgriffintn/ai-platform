import { fetchProviderJson } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord, generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getRecipeConnectorAccessToken } from "~/modules/connectors/application";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";

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
    externalId: string,
  ): Promise<string | null> {
    if (!this.config.user?.id) {
      return null;
    }

    const repository = this.getSourceRepository();
    const memory = await repository.insertMemorySource({
      createdByUserId: this.config.user.id,
      projectId: this.memoryScope.type === "project" ? this.memoryScope.projectId : undefined,
      conversationId: input.conversationId,
      title: input.text.slice(0, 120) || "Memory",
      status: "available",
      content: input.text,
      provider: this.name,
      vectorId: externalId,
      metadata: {
        ...input.metadata,
        category: input.metadata.category || "general",
        memory_provider: this.name,
        external_id: externalId,
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

  protected async removeLocalMemory(memoryId: string): Promise<void> {
    const repository = this.getSourceRepository();

    await repository.removeSourceFromCollections(memoryId);
    await repository.deleteSource(memoryId);
  }

  protected getSourceRepository(): SourceRepository {
    return (
      this.config.serviceContext?.repositories.get(SourceRepository) ??
      new SourceRepository(this.config.env)
    );
  }

  protected getUserTag(): string | undefined {
    return this.config.user?.id ? `user:${this.config.user.id}` : undefined;
  }

  protected createProviderRecordId(prefix: string): string {
    return `${prefix}_${generateId().replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }
}
