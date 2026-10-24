import { studyProgressSchema, type StudyProgress } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResponse } from "~/infrastructure/storage/read-resource";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { requireOutputAccess } from "~/modules/outputs/application/access";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { requireNotebookAccess } from "./access";
import { videoSceneImageKey } from "./studio/video";

async function requireNotebookOutput(
  context: ServiceContext,
  notebookId: string,
  outputId: string,
): Promise<number> {
  const user = context.requireUser();

  await requireNotebookAccess(context, notebookId);

  const output = await requireOutputAccess(context, user.id, outputId);
  const conversation = output.conversation_id
    ? await context.repositories.get(ConversationRepository).getConversation(output.conversation_id)
    : null;

  if (output.collection_id !== notebookId && conversation?.group_id !== notebookId) {
    throw new AssistantError("Output not found in this notebook", ErrorType.NOT_FOUND, 404);
  }

  return user.id;
}

export async function getStudyProgress(
  context: ServiceContext,
  notebookId: string,
  outputId: string,
): Promise<StudyProgress> {
  const userId = await requireNotebookOutput(context, notebookId, outputId);
  const stored = await context.repositories.get(OutputRepository).readViewerState(outputId, userId);

  return studyProgressSchema
    .catch(studyProgressSchema.parse({}))
    .parse(safeParseJson(stored ?? "{}") ?? {});
}

export async function saveStudyProgress(
  context: ServiceContext,
  notebookId: string,
  outputId: string,
  progress: StudyProgress,
): Promise<StudyProgress> {
  const userId = await requireNotebookOutput(context, notebookId, outputId);

  await context.repositories.get(OutputRepository).writeViewerState(outputId, userId, progress);

  return progress;
}

export async function readVideoSceneImage(
  context: ServiceContext,
  notebookId: string,
  outputId: string,
  index: number,
  rangeHeader?: string | null,
): Promise<Response> {
  await requireNotebookOutput(context, notebookId, outputId);

  const object = await StorageService.forPrivateAssets(context).getObjectBody(
    videoSceneImageKey(outputId, index),
  );

  if (!object) {
    throw new AssistantError("Scene image not found", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateFileResponse(
    {
      mime_type: object.httpMetadata?.contentType ?? "image/png",
      filename: `scene-${index + 1}`,
    },
    object,
    rangeHeader,
  );
}
