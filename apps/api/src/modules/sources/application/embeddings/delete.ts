import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { EmbeddingRepository } from "~/modules/memory/infrastructure/EmbeddingRepository";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import type { IEnv, IUser } from "~/types";

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
  const documents = await serviceContext.repositories
    .get(EmbeddingRepository)
    .getDocumentsForDeletion(authenticatedUser.id, input.ids);

  if (documents.length === 0) {
    return { status: "success", data: { ids: input.ids } };
  }

  const documentIds = documents.map((document) => document.id);

  await serviceContext.repositories
    .get(EmbeddingRepository)
    .markDocumentsDeletePending(authenticatedUser.id, documentIds);

  const userSettings = await getRequestUserSettings(serviceContext);

  if (!userSettings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  await deleteProviderDocuments({
    context: serviceContext,
    user: authenticatedUser,
    userSettings,
    documents,
  });

  await serviceContext.repositories
    .get(EmbeddingRepository)
    .deleteDocuments(authenticatedUser.id, documentIds);

  return { status: "success", data: { ids: input.ids } };
};
