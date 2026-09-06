import { excerptMemoryDocument } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MemoryDocumentScopeKey } from "~/repositories/MemoryDocumentRepository";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import type {
  MemoryProvider,
  MemoryProviderCapabilities,
  MemoryRetrieveOptions,
  MemoryRetrieveResult,
  MemoryStoreInput,
  MemoryStoreResult,
} from "../types";

export const MEMORY_JOURNAL_DOCUMENT = "what-you-have-told-me";
const DEFAULT_TOP_K = 5;
const MAX_SEARCH_RESULTS = 20;

export interface DocumentsMemoryProviderConfig {
  env: IEnv;
  user?: IUser;
  userSettings?: IUserSettings | null;
  serviceContext?: ServiceContext;
  memoryScope?: MemoryScope;
}

/**
 * Keeps memories as plain documents the person can read, edit and roll back, rather than as
 * opaque vectors. Every write appends a revision, so nothing is silently overwritten.
 */
export class DocumentsMemoryProvider implements MemoryProvider {
  readonly name = "documents" as const;

  readonly capabilities: MemoryProviderCapabilities = {
    deduplication: false,
    reasoning: false,
    conversationIngestion: false,
    externalStorage: false,
    deletion: true,
  };

  constructor(private readonly config: DocumentsMemoryProviderConfig) {}

  async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
    const { context, scope, userId } = this.requireScope();
    const repository = context.repositories.memoryDocuments;
    const existing = await repository.getDocumentByName(scope, MEMORY_JOURNAL_DOCUMENT);
    const entry = this.formatEntry(input);

    if (!existing) {
      const created = await repository.createDocument({
        ...scope,
        name: MEMORY_JOURNAL_DOCUMENT,
        content: entry,
        createdByUserId: userId,
      });

      return { id: created.id, provider: this.name };
    }

    const appended = await repository.appendRevision({
      documentId: existing.id,
      content: `${existing.content.trimEnd()}\n${entry}`.trim(),
      changeNote: "Remembered something from a conversation",
      createdByUserId: userId,
      expectedRevision: existing.revision,
    });

    return { id: appended?.id ?? existing.id, provider: this.name };
  }

  async retrieveMemories(
    query: string,
    options?: MemoryRetrieveOptions,
  ): Promise<MemoryRetrieveResult[]> {
    const { context, scope } = this.requireScope();
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    const limit = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_SEARCH_RESULTS);
    const documents = await context.repositories.memoryDocuments.searchDocuments(
      scope,
      trimmed,
      limit,
    );

    return documents.map((document) => ({
      id: document.id,
      text: `${document.name}\n${document.content}`,
      score: 1,
      metadata: {
        name: document.name,
        revision: document.revision,
        excerpt: excerptMemoryDocument(document.content),
      },
    }));
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const { context } = this.requireScope();

    await context.repositories.memoryDocuments.softDeleteDocument(memoryId);

    return true;
  }

  private formatEntry(input: MemoryStoreInput): string {
    const source = input.conversationId ? ` (from conversation ${input.conversationId})` : "";

    return `- ${input.text.trim()}${source}`;
  }

  private requireScope(): {
    context: ServiceContext;
    scope: MemoryDocumentScopeKey;
    userId: number;
  } {
    const context = this.config.serviceContext;
    const userId = this.config.user?.id;

    if (!context || !userId) {
      throw new AssistantError(
        "Document memories need a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const memoryScope = this.config.memoryScope;
    const scope: MemoryDocumentScopeKey =
      memoryScope?.type === "project"
        ? { scopeType: "project", scopeId: memoryScope.projectId }
        : { scopeType: "personal", scopeId: String(userId) };

    return { context, scope, userId };
  }
}
