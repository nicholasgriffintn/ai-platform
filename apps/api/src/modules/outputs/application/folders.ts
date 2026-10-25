import { listPageOf, type ListPage, type OutputSummary } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { requireCollectionAccess } from "~/modules/sources/application/sources";

import { requireOutputAccess } from "./access";
import { formatOutputSummary } from "./index";

export async function listCollectionOutputs(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<ListPage<OutputSummary>> {
  await requireCollectionAccess(context, userId, collectionId);

  return listPageOf(
    (await context.repositories.get(OutputRepository).listLinkedOutputs(collectionId)).map(
      formatOutputSummary,
    ),
    (output) => output.id,
  );
}

export async function addCollectionOutputs(
  context: ServiceContext,
  userId: number,
  collectionId: string,
  outputIds: string[],
): Promise<{ added: number }> {
  const collection = await requireCollectionAccess(context, userId, collectionId, true);

  if (collection.kind !== "general") {
    throw new AssistantError("Only folders can hold made items", ErrorType.PARAMS_ERROR, 400);
  }

  for (const outputId of outputIds) {
    const output = await requireOutputAccess(context, userId, outputId);

    if (output.project_id !== collection.project_id) {
      throw new AssistantError("Item is outside this folder's scope", ErrorType.PARAMS_ERROR, 400);
    }
  }

  return {
    added: await context.repositories.get(OutputRepository).linkOutputs(collectionId, outputIds),
  };
}
