import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { memorySearchPassage } from "~/modules/memory-documents/application/pages";
import { requireRunMemoryDocument } from "~/modules/memory-documents/application/run-access";
import type { MemoryDocumentScopeKey } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { publishConversationChanged } from "~/modules/sync/application/conversation-events";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";

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
const MAX_APPEND_ATTEMPTS = 3;

export interface DocumentsMemoryProviderConfig {
  env: IEnv;
  user?: IUser;
  userSettings?: IUserSettings | null;
  serviceContext?: ServiceContext;
  memoryScope?: MemoryScope;
}

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
    const { context, userId } = this.requireContext();
    const memoryScope = this.config.memoryScope;
    const entry = this.formatEntry(input);

    if (memoryScope?.type === "bound") {
      const writable = memoryScope.documents.filter((binding) => binding.access === "read-write");
      const selectedDocumentId =
        input.documentId ??
        memoryScope.teammateContext?.memoryDocumentId ??
        (writable.length === 1 ? writable[0].documentId : undefined);
      const selected = writable.find((binding) => binding.documentId === selectedDocumentId);

      if (!selected) {
        throw new AssistantError(
          "Choose one of the writable memory documents available to this run",
          ErrorType.AUTHORISATION_ERROR,
          403,
        );
      }

      const { document } = await requireRunMemoryDocument(
        context,
        memoryScope,
        selected.documentId,
        "read-write",
      );

      if (document.kind === "teammate_context") {
        throw new AssistantError(
          "Teammate memory requires source-backed maintenance",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      const result = await this.appendEntry(document, entry, userId, undefined, input.operationId);

      if (memoryScope.conversationId) {
        await publishConversationChanged(context, memoryScope.conversationId);
      }

      return result;
    }

    const { scope } = await this.requireScope();
    const repository = context.repositories.memoryDocuments;
    const existing = await repository.getDocumentByName(scope, MEMORY_JOURNAL_DOCUMENT);

    if (!existing) {
      try {
        const created = await repository.createDocument({
          ...scope,
          name: MEMORY_JOURNAL_DOCUMENT,
          content: entry,
          createdByUserId: userId,
          operationId: input.operationId,
        });

        return { id: created.id, provider: this.name };
      } catch (error) {
        const raced = await repository.getDocumentByName(scope, MEMORY_JOURNAL_DOCUMENT);

        if (!raced) {
          throw error;
        }

        return this.appendEntry(raced, entry, userId, scope, input.operationId);
      }
    }

    return this.appendEntry(existing, entry, userId, scope, input.operationId);
  }

  private async appendEntry(
    initial: MemoryDocumentRow,
    entry: string,
    userId: number,
    scope?: MemoryDocumentScopeKey,
    operationId?: string,
  ): Promise<MemoryStoreResult> {
    const repository = this.requireContext().context.repositories.memoryDocuments;
    let existing = initial;

    for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
      const appended = await repository.appendRevision({
        documentId: existing.id,
        content: `${existing.content.trimEnd()}\n${entry}`.trim(),
        changeNote: "Remembered something from a conversation",
        createdByUserId: userId,
        expectedRevision: existing.revision,
        operationId,
      });

      if (appended) {
        return { id: appended.id, provider: this.name };
      }

      const current = scope
        ? await repository.getDocumentByName(scope, MEMORY_JOURNAL_DOCUMENT)
        : await repository.getDocumentById(existing.id);

      if (!current || current.id !== existing.id) {
        break;
      }

      existing = current;
    }

    throw new AssistantError(
      "This memory changed repeatedly while it was being saved. Try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  async retrieveMemories(
    query: string,
    options?: MemoryRetrieveOptions,
  ): Promise<MemoryRetrieveResult[]> {
    const { context } = this.requireContext();
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    const limit = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_SEARCH_RESULTS);
    const memoryScope = this.config.memoryScope;

    if (memoryScope?.type === "bound") {
      const documents = await Promise.all(
        memoryScope.documents.map(async (binding) => {
          try {
            const { document } = await requireRunMemoryDocument(
              context,
              memoryScope,
              binding.documentId,
            );

            return document;
          } catch (error) {
            if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
              return null;
            }

            throw error;
          }
        }),
      );

      return documents
        .filter((document) => document !== null)
        .filter((document) =>
          `${document.name}\n${document.content}`.toLowerCase().includes(trimmed),
        )
        .slice(0, limit)
        .map((document) => memorySearchPassage(document, trimmed));
    }

    const { scope } = await this.requireScope();
    const documents = await context.repositories.memoryDocuments.searchDocuments(
      scope,
      trimmed,
      limit,
    );

    return documents.map((document) => memorySearchPassage(document, trimmed));
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const { context, scope } = await this.requireScope();
    const memoryScope = this.config.memoryScope;

    if (memoryScope?.type === "bound") {
      if (memoryScope.teammateContext?.memoryDocumentId === memoryId) {
        throw new AssistantError(
          "A teammate's working memory cannot be deleted while its context exists",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      await requireRunMemoryDocument(context, memoryScope, memoryId, "read-write");
    } else {
      const document = await context.repositories.memoryDocuments.getDocumentById(memoryId);

      if (
        !document ||
        document.kind !== "memory" ||
        document.scope_type !== scope.scopeType ||
        document.scope_id !== scope.scopeId
      ) {
        throw new AssistantError("The memory document is unavailable", ErrorType.FORBIDDEN, 403);
      }
    }

    await context.repositories.memoryDocuments.softDeleteDocument(memoryId);

    return true;
  }

  private formatEntry(input: MemoryStoreInput): string {
    const source = input.conversationId ? ` (from conversation ${input.conversationId})` : "";

    return `- ${input.text.trim()}${source}`;
  }

  private async requireScope(): Promise<{
    context: ServiceContext;
    scope: MemoryDocumentScopeKey;
    userId: number;
  }> {
    const { context, userId } = this.requireContext();

    const memoryScope = this.config.memoryScope;
    const scope: MemoryDocumentScopeKey =
      memoryScope?.type === "project"
        ? { scopeType: "project", scopeId: memoryScope.projectId }
        : { scopeType: "personal", scopeId: String(userId) };

    if (scope.scopeType === "project") {
      await requireProjectAccess(context, scope.scopeId);
    }

    return { context, scope, userId };
  }

  private requireContext(): { context: ServiceContext; userId: number } {
    const context = this.config.serviceContext;
    const userId = this.config.user?.id;

    if (!context || !userId || context.requireUser().id !== userId) {
      throw new AssistantError(
        "Document memories need a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    return { context, userId };
  }
}
