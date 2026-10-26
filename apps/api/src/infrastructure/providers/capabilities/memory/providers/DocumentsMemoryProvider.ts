import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { enqueueKnowledgeProcessing } from "~/modules/knowledge/application/index/indexing";
import { searchMemoryKnowledge } from "~/modules/knowledge/application/query/memory";
import { memoryPassageResult } from "~/modules/memory-documents/application/pages";
import {
  rememberInDocument,
  rememberInScope,
} from "~/modules/memory-documents/application/remember";
import { requireRunMemoryDocument } from "~/modules/memory-documents/application/run-access";
import type { MemoryDocumentScopeKey } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
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

const DEFAULT_TOP_K = 5;
const MAX_SEARCH_RESULTS = 20;

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
    deduplication: true,
    reasoning: false,
    conversationIngestion: false,
    externalStorage: false,
    deletion: true,
    semanticSearch: true,
  };

  constructor(private readonly config: DocumentsMemoryProviderConfig) {}

  async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
    const { context, userId } = this.requireContext();
    const memoryScope = this.config.memoryScope;
    const note = {
      text: input.text,
      category: input.metadata.category,
      conversationId: input.conversationId,
      operationId: input.operationId,
    };

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

      const written = await rememberInDocument(context, document, userId, note);

      await this.queueIndexing(context, written, userId);

      if (memoryScope.conversationId) {
        await publishConversationChanged(context, memoryScope.conversationId);
      }

      return { id: written.id, provider: this.name };
    }

    const { scope } = await this.requireScope();
    const written = await rememberInScope(context, scope, userId, note);

    await this.queueIndexing(context, written, userId);

    return { id: written.id, provider: this.name };
  }

  async retrieveMemories(
    query: string,
    options?: MemoryRetrieveOptions,
  ): Promise<MemoryRetrieveResult[]> {
    const { context } = this.requireContext();
    const trimmed = query.trim();

    if (!trimmed) {
      return [];
    }

    const limit = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_SEARCH_RESULTS);
    const searches = await this.searchScopes(context);
    const passages = (
      await Promise.all(
        searches.map((scope) => searchMemoryKnowledge(context, scope, trimmed, limit)),
      )
    )
      .flat()
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    const repository = context.repositories.get(MemoryDocumentRepository);
    const documents = new Map(
      (
        await Promise.all(
          [...new Set(passages.map((passage) => passage.documentId))].map((id) =>
            repository.getDocumentById(id),
          ),
        )
      )
        .filter((document) => document !== null)
        .map((document) => [document.id, document]),
    );

    return passages.flatMap((passage) => {
      const document = documents.get(passage.documentId);

      return document ? [memoryPassageResult(document, passage)] : [];
    });
  }

  private async queueIndexing(
    context: ServiceContext,
    document: MemoryDocumentRow,
    userId: number,
  ): Promise<void> {
    await enqueueKnowledgeProcessing(
      context.env,
      { id: document.id, project_id: document.scope_type === "project" ? document.scope_id : null },
      userId,
      "memory",
    );
  }

  private async searchScopes(
    context: ServiceContext,
  ): Promise<{ projectId: string | null; documentIds?: string[] }[]> {
    const memoryScope = this.config.memoryScope;

    if (memoryScope?.type !== "bound") {
      const { scope } = await this.requireScope();

      return [{ projectId: scope.scopeType === "project" ? scope.scopeId : null }];
    }

    const readable = await Promise.all(
      memoryScope.documents.map(async (binding) => {
        try {
          return (await requireRunMemoryDocument(context, memoryScope, binding.documentId))
            .document;
        } catch (error) {
          if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
            return null;
          }

          throw error;
        }
      }),
    );
    const byScope = new Map<string | null, string[]>();

    for (const document of readable) {
      if (document) {
        const projectId = document.scope_type === "project" ? document.scope_id : null;

        byScope.set(projectId, [...(byScope.get(projectId) ?? []), document.id]);
      }
    }

    return [...byScope].map(([projectId, documentIds]) => ({ projectId, documentIds }));
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
      const document = await context.repositories
        .get(MemoryDocumentRepository)
        .getDocumentById(memoryId);

      if (
        !document ||
        document.kind !== "memory" ||
        document.scope_type !== scope.scopeType ||
        document.scope_id !== scope.scopeId
      ) {
        throw new AssistantError("The memory document is unavailable", ErrorType.FORBIDDEN, 403);
      }
    }

    await context.repositories.get(MemoryDocumentRepository).softDeleteDocument(memoryId);

    return true;
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
