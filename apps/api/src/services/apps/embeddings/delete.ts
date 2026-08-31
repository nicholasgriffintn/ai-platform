import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { deleteProviderDocuments } from "./deletion";
import { parseDeleteEmbeddingRequest } from "./requests";

interface DeleteEmbeddingRequest {
  request: unknown;
  context?: ServiceContext;
  env?: IEnv;
  user?: IUser;
}

export const deleteEmbedding = async ({ request, context, env, user }: DeleteEmbeddingRequest) => {
  const serviceContext = resolveServiceContext({ context, env, user });
  const authenticatedUser = serviceContext.requireUser();
  const input = parseDeleteEmbeddingRequest(request);
  const documents = await serviceContext.repositories.embeddings.getDocumentsForDeletion(
    authenticatedUser.id,
    input.ids,
  );

  if (documents.length === 0) {
    return { status: "success", data: { ids: input.ids } };
  }

  const documentIds = documents.map((document) => document.id);

  await serviceContext.repositories.embeddings.markDocumentsDeletePending(
    authenticatedUser.id,
    documentIds,
  );

  const userSettings = await serviceContext.getUserSettings();

  if (!userSettings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  await deleteProviderDocuments({
    context: serviceContext,
    user: authenticatedUser,
    userSettings,
    documents,
  });

  await serviceContext.repositories.embeddings.deleteDocuments(authenticatedUser.id, documentIds);

  return { status: "success", data: { ids: input.ids } };
};
