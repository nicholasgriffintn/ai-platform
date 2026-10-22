import {
  getSourceMediaType,
  isTranscribableMediaType,
  formatTranscriptText,
  SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE,
  type Source,
  type SourceTranscript,
} from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { handleTranscribe } from "~/modules/audio/application/transcribe";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { readSourceRecordMedia, updateSourceRecord } from "./metadata";

function requireTranscribableSource(source: SourceRecord): string {
  if (!source.storage_key || !isTranscribableMediaType(getSourceMediaType(source.mime_type))) {
    throw new AssistantError(
      "Only audio and video sources can be transcribed",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return source.storage_key;
}

export async function startSourceTranscription(
  context: ServiceContext,
  userId: number,
  sourceId: string,
): Promise<Source> {
  const source = await requireSourceAccess(context, userId, sourceId, true);

  requireTranscribableSource(source);

  if (readSourceRecordMedia(source).transcript?.status === "processing") {
    return formatSource(source);
  }

  const updated = await updateSourceRecord(context, source, {
    media: { transcript: { status: "processing", speakers: {}, segments: [] } },
  });

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    task_type: SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE,
    user_id: userId,
    project_id: source.project_id ?? undefined,
    task_data: { sourceId },
    priority: 6,
  });

  return formatSource(updated);
}

export async function runSourceTranscription(
  context: ServiceContext,
  sourceId: string,
): Promise<SourceRecord | null> {
  const source = await context.repositories.get(SourceRepository).getSource(sourceId);

  if (!source || readSourceRecordMedia(source).transcript?.status !== "processing") {
    return null;
  }

  try {
    const storageKey = requireTranscribableSource(source);
    const object = await StorageService.forPrivateAssets(context).getObjectBody(storageKey);

    if (!object) {
      throw new AssistantError("Source file not found", ErrorType.NOT_FOUND, 404);
    }

    const file = new Blob([await object.arrayBuffer()], {
      type: source.mime_type ?? "application/octet-stream",
    });
    const result = await handleTranscribe({
      env: context.env,
      user: context.requireUser(),
      audio: { kind: "file", file },
      allowVideo: true,
      timestamps: true,
    });
    const transcript: SourceTranscript = {
      status: "ready",
      speakers: {},
      segments: result.segments?.length
        ? result.segments.map(({ start, end, text, speaker }) => ({ start, end, text, speaker }))
        : [{ text: result.content }],
    };

    return await updateSourceRecord(context, source, {
      content: formatTranscriptText(transcript),
      media: { transcript },
    });
  } catch (error) {
    return updateSourceRecord(context, source, {
      media: {
        transcript: {
          status: "failed",
          speakers: {},
          segments: [],
          error: getErrorMessage(error, "Transcription failed"),
        },
      },
    });
  }
}
