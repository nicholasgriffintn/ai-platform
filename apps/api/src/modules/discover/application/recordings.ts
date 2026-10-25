import type { DiscoverEditionRecording } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getPrivateFileResponse, readPrivateFile } from "~/infrastructure/storage/read-resource";
import { getSource } from "~/modules/sources/application/sources";

import { requireDiscoverEdition } from "./editions";

async function recordingSourceId(
  context: ServiceContext,
  editionId: string,
  recording: DiscoverEditionRecording,
): Promise<string> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const sourceId =
    recording === "listen" ? edition.content.listenSourceId : edition.content.weekSourceId;

  if (!sourceId) {
    throw new AssistantError("This edition has no recording yet", ErrorType.NOT_FOUND, 404);
  }

  return sourceId;
}

export async function readEditionRecording(
  context: ServiceContext,
  editionId: string,
  recording: DiscoverEditionRecording,
) {
  const sourceId = await recordingSourceId(context, editionId, recording);

  return getSource(context, context.requireUser().id, sourceId);
}

export async function readEditionRecordingAudio(
  context: ServiceContext,
  editionId: string,
  recording: DiscoverEditionRecording,
  range: string | undefined,
): Promise<Response> {
  const sourceId = await recordingSourceId(context, editionId, recording);
  const file = await readPrivateFile({
    context,
    kind: "source",
    resourceId: sourceId,
    userId: context.requireUser().id,
  });

  return getPrivateFileResponse(file.record, file.object, range);
}
