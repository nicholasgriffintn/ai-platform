import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { resolveEmbeddingRuntime } from "~/lib/providers/capabilities/embedding/helpers";
import { getPersonalEmbeddingScopeTag } from "~/lib/providers/capabilities/embedding/utils/scope";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { deleteProviderDocuments } from "./deletion";
import { prepareEmbeddingDocument } from "./document";
import { cleanupPendingEmbeddingDocument, generateEmbeddingVectors } from "./lifecycle";
import { parseInsertEmbeddingRequest } from "./requests";

interface InsertEmbeddingRequest {
  request: unknown;
  context?: ServiceContext;
  env?: IEnv;
  user?: IUser;
}

export const insertEmbedding = async ({ request, context, env, user }: InsertEmbeddingRequest) => {
  const serviceContext = resolveServiceContext({ context, env, user });
  const authenticatedUser = serviceContext.requireUser();
  const input = parseInsertEmbeddingRequest(request);
  const document = prepareEmbeddingDocument(input);

  const userSettings = await serviceContext.getUserSettings();

  if (!userSettings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  const { runtime, target } = await resolveEmbeddingRuntime(
    serviceContext.env,
    authenticatedUser,
    userSettings,
  );
  const scopeTag = await getPersonalEmbeddingScopeTag(
    serviceContext.env.EMBEDDING_SCOPE_SECRET,
    authenticatedUser.id,
  );
  const vectorIds = document.chunks.map((chunk) => chunk.vectorId);
  let documentCreated = false;
  let providerWriteAttempted = false;
  let compensationIsSafe = true;

  try {
    const pendingDocument = await serviceContext.repositories.embeddings.getPendingDocumentForRetry(
      authenticatedUser.id,
      document.logicalId,
    );

    if (pendingDocument) {
      await deleteProviderDocuments({
        context: serviceContext,
        user: authenticatedUser,
        userSettings,
        documents: [pendingDocument],
      });
      await serviceContext.repositories.embeddings.removePendingDocument(
        authenticatedUser.id,
        pendingDocument.id,
      );
    }

    await serviceContext.repositories.embeddings.createDocument({
      id: document.documentId,
      logicalId: document.logicalId,
      userId: authenticatedUser.id,
      type: input.type,
      title: document.title,
      metadata: input.metadata ?? {},
      provider: target.embeddingProvider,
      providerTarget: target.providerTarget,
      embeddingModel: target.model,
      embeddingDimensions: target.dimensions,
      distanceMetric: target.distanceMetric,
      taskMode: target.taskMode,
      vectorSpace: target.vectorSpace,
      vectorSpaceVersion: target.vectorSpaceVersion,
      chunks: document.chunks,
    });
    documentCreated = true;

    const generated = await generateEmbeddingVectors(
      runtime.embedder,
      document.documentId,
      input.type,
      document.chunks,
    );

    providerWriteAttempted = true;
    const inserted = await runtime.vectorStore.insert(generated, {
      scopeTag,
      contentType: input.type,
    });

    if (inserted.status !== "success") {
      throw new AssistantError(
        "Embedding provider rejected the document",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    try {
      await serviceContext.repositories.embeddings.activateDocument(
        authenticatedUser.id,
        document.documentId,
      );
    } catch (error) {
      try {
        const lifecycleStatus =
          await serviceContext.repositories.embeddings.getDocumentLifecycleStatus(
            authenticatedUser.id,
            document.documentId,
          );

        if (lifecycleStatus === "active") {
          return {
            status: "success",
            data: {
              id: document.logicalId,
              metadata: input.metadata ?? {},
              title: document.title,
              content: document.content,
              type: input.type,
            },
          };
        }

        compensationIsSafe = lifecycleStatus !== undefined;
      } catch {
        compensationIsSafe = false;
      }

      throw error;
    }

    return {
      status: "success",
      data: {
        id: document.logicalId,
        metadata: input.metadata ?? {},
        title: document.title,
        content: document.content,
        type: input.type,
      },
    };
  } catch (error) {
    if (documentCreated && compensationIsSafe) {
      await cleanupPendingEmbeddingDocument({
        context: serviceContext,
        vectorStore: runtime.vectorStore,
        providerWriteAttempted,
        userId: authenticatedUser.id,
        documentId: document.documentId,
        vectorIds,
      });
    }

    if (error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR) {
      throw error;
    }

    throw new AssistantError("Failed to insert embedding document", ErrorType.PROVIDER_ERROR, 502);
  }
};
