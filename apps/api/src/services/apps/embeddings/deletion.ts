import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  getEmbeddingProviderForTarget,
  isQuarantinedEmbeddingProviderTarget,
  type EmbeddingProviderTarget,
} from "~/lib/providers/capabilities/embedding/helpers";
import type { EmbeddingDocumentDeletionTarget } from "~/repositories/EmbeddingRepository";
import type { IUser, IUserSettings } from "~/types";
import { mapWithConcurrency } from "~/utils/async";
import { AssistantError, ErrorType } from "~/utils/errors";

type DocumentsByProviderTarget = {
  documents: EmbeddingDocumentDeletionTarget[];
  target: EmbeddingProviderTarget;
};
const PROVIDER_DELETE_CONCURRENCY = 4;

const groupDocumentsByProviderTarget = (
  documents: EmbeddingDocumentDeletionTarget[],
): DocumentsByProviderTarget[] => {
  const groups = new Map<string, DocumentsByProviderTarget>();

  for (const document of documents) {
    const target = {
      provider: document.provider,
      target: document.providerTarget,
      model: document.embeddingModel,
      vectorSpace: document.vectorSpace,
      vectorSpaceVersion: document.vectorSpaceVersion,
    };
    const targetKey = JSON.stringify(target);
    const group = groups.get(targetKey) ?? { documents: [], target };

    group.documents.push(document);
    groups.set(targetKey, group);
  }

  return [...groups.values()];
};

export const deleteProviderDocuments = async ({
  context,
  user,
  userSettings,
  documents,
}: {
  context: ServiceContext;
  user: IUser;
  userSettings: IUserSettings;
  documents: EmbeddingDocumentDeletionTarget[];
}): Promise<void> => {
  await mapWithConcurrency(
    groupDocumentsByProviderTarget(documents),
    PROVIDER_DELETE_CONCURRENCY,
    async ({ documents: group, target }) => {
      if (isQuarantinedEmbeddingProviderTarget(target)) {
        return;
      }

      const provider = getEmbeddingProviderForTarget(context.env, user, userSettings, target);
      const vectorIds = group.flatMap((document) => document.vectorIds);

      if (vectorIds.length === 0) {
        return;
      }

      let result;

      try {
        result = await provider.delete(vectorIds);
      } catch (error) {
        if (error instanceof AssistantError) {
          throw error;
        }

        throw new AssistantError(
          "Embedding provider could not delete the document",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      if (result.status !== "success") {
        throw new AssistantError(
          "Embedding provider could not delete the document",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }
    },
  );
};
