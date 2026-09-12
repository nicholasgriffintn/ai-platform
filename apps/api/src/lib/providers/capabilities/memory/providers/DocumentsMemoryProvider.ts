import { excerptMemoryDocument } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MemoryDocumentRow } from "~/lib/database/schema";
import type { MemoryDocumentScopeKey } from "~/repositories/MemoryDocumentRepository";
import { publishConversationChanged } from "~/services/sync/conversation-events";
import { requireProjectTeammate } from "~/services/teammates/access";
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
const MAX_APPEND_ATTEMPTS = 3;

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

      const document = await context.repositories.memoryDocuments.getDocumentById(
        selected.documentId,
      );

      if (!document || !(await this.documentMatchesBoundScope(document, memoryScope, userId))) {
        throw new AssistantError(
          "The writable memory document is no longer available",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      const result = await this.appendEntry(document, entry, userId, undefined, input.operationId);

      if (memoryScope.conversationId) {
        await publishConversationChanged(context, memoryScope.conversationId);
      }

      return result;
    }

    const { scope } = this.requireScope();
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
        memoryScope.documents.map((binding) =>
          context.repositories.memoryDocuments.getDocumentById(binding.documentId),
        ),
      );
      const authorisedDocuments: MemoryDocumentRow[] = [];

      for (const document of documents) {
        if (
          document &&
          (await this.documentMatchesBoundScope(
            document,
            memoryScope,
            this.requireContext().userId,
          ))
        ) {
          authorisedDocuments.push(document);
        }
      }

      return authorisedDocuments
        .filter((document) =>
          `${document.name}\n${document.content}`.toLowerCase().includes(trimmed),
        )
        .slice(0, limit)
        .map((document) => ({
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

    const { scope } = this.requireScope();
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
    const memoryScope = this.config.memoryScope;

    if (memoryScope?.type === "bound") {
      if (memoryScope.teammateContext?.memoryDocumentId === memoryId) {
        throw new AssistantError(
          "A teammate's working memory cannot be deleted while its context exists",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      const binding = memoryScope.documents.find(
        (candidate) => candidate.documentId === memoryId && candidate.access === "read-write",
      );
      const document = binding
        ? await context.repositories.memoryDocuments.getDocumentById(memoryId)
        : null;

      if (
        !document ||
        !(await this.documentMatchesBoundScope(document, memoryScope, this.requireContext().userId))
      ) {
        throw new AssistantError(
          "The memory document is not writable in this run",
          ErrorType.FORBIDDEN,
          403,
        );
      }
    }

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
    const { context, userId } = this.requireContext();

    const memoryScope = this.config.memoryScope;
    const scope: MemoryDocumentScopeKey =
      memoryScope?.type === "project"
        ? { scopeType: "project", scopeId: memoryScope.projectId }
        : { scopeType: "personal", scopeId: String(userId) };

    return { context, scope, userId };
  }

  private requireContext(): { context: ServiceContext; userId: number } {
    const context = this.config.serviceContext;
    const userId = this.config.user?.id;

    if (!context || !userId) {
      throw new AssistantError(
        "Document memories need a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    return { context, userId };
  }

  private async documentMatchesBoundScope(
    document: MemoryDocumentRow,
    scope: Extract<MemoryScope, { type: "bound" }>,
    userId: number,
  ): Promise<boolean> {
    const context = this.requireContext().context;

    if (!scope.teammateContext) {
      return document.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
    }

    const teammateContext = await context.repositories.teammateContexts.getById(
      scope.teammateContext.id,
    );

    if (
      !teammateContext ||
      teammateContext.actorUserId !== userId ||
      teammateContext.status !== "active" ||
      teammateContext.scope.type !== scope.scopeType ||
      teammateContext.scope.id !== scope.scopeId
    ) {
      return false;
    }

    if (teammateContext.scope.type === "project") {
      await requireProjectTeammate(context, teammateContext.scope.id, teammateContext.teammateId);
    }

    const isBoundScopeDocument =
      document.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
    const isPrivateContextDocument =
      teammateContext.memoryDocumentId === document.id &&
      document.scope_type === "personal" &&
      document.scope_id === String(userId);

    return isBoundScopeDocument || isPrivateContextDocument;
  }
}
