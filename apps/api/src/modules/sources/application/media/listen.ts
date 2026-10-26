import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  SOURCE_LISTEN_TASK_TYPE,
  type Source,
  type SourceListen,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateObjectResponse } from "~/infrastructure/storage/read-resource";
import { narratePassages } from "~/modules/audio/application/narration";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";
import { buildListenPassages, canListenToSource } from "~/modules/sources/domain/listen";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { readSourceRecordListen, updateSourceRecord } from "./metadata";

const logger = getLogger({ prefix: "sources/listen" });

function passageKey(sourceId: string, passage: number): string {
  return `sources/${sourceId}/listen/${passage}.mp3`;
}

async function listenableText(context: ServiceContext, source: SourceRecord): Promise<string> {
  const content = await readKnowledgeText(context, source);

  if (!canListenToSource({ kind: source.kind, content, mimeType: source.mime_type })) {
    throw new AssistantError("This source has no text to read aloud", ErrorType.PARAMS_ERROR, 400);
  }

  return content;
}

export async function startSourceListen(
  context: ServiceContext,
  userId: number,
  sourceId: string,
): Promise<Source> {
  const source = await requireSourceAccess(context, userId, sourceId);
  const content = await listenableText(context, source);
  const contentHash = await sha256Hex(content);
  const current = readSourceRecordListen(source);

  if (current && current.contentHash === contentHash && current.status !== "failed") {
    return formatSource(source);
  }

  const passages = buildListenPassages(content);

  if (passages.length === 0) {
    throw new AssistantError("This source has no text to read aloud", ErrorType.PARAMS_ERROR, 400);
  }

  const updated = await updateSourceRecord(context, source, {
    listen: {
      status: "making",
      contentHash,
      passages: passages.map((text) => ({ text, audio: false })),
    },
  });

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    task_type: SOURCE_LISTEN_TASK_TYPE,
    user_id: userId,
    project_id: source.project_id ?? undefined,
    task_data: { sourceId, contentHash, runId: context.executionRunId },
    priority: 5,
  });

  return formatSource(updated);
}

async function saveListen(
  context: ServiceContext,
  sourceId: string,
  update: (listen: SourceListen) => SourceListen,
): Promise<SourceListen | null> {
  const latest = await context.repositories.get(SourceRepository).getSource(sourceId);
  const listen = latest ? readSourceRecordListen(latest) : null;

  if (!latest || !listen) {
    return null;
  }

  const next = update(listen);

  await updateSourceRecord(context, latest, { listen: next });

  return next;
}

export async function runSourceListen(
  context: ServiceContext,
  sourceId: string,
  contentHash: string,
): Promise<SourceListen | null> {
  const source = await context.repositories.get(SourceRepository).getSource(sourceId);
  const listen = source ? readSourceRecordListen(source) : null;

  if (!listen || listen.status !== "making" || listen.contentHash !== contentHash) {
    return listen;
  }

  const storage = StorageService.forPrivateAssets(context);
  const last = listen.passages.length - 1;

  try {
    await narratePassages(
      context,
      listen.passages.map((passage) => passage.text),
      {
        language: "en",
        onPassage: async (index, audio) => {
          await storage.uploadObject(passageKey(sourceId, index), audio, {
            httpMetadata: { contentType: "audio/mpeg" },
          });
          await saveListen(context, sourceId, (current) =>
            current.contentHash === contentHash
              ? {
                  ...current,
                  status: index === last ? "ready" : current.status,
                  passages: current.passages.map((passage, position) =>
                    position === index ? { ...passage, audio: true } : passage,
                  ),
                }
              : current,
          );
        },
      },
    );
  } catch (error) {
    logger.error("Reading a source aloud failed", {
      sourceId,
      error_message: getErrorMessage(error),
    });

    return saveListen(context, sourceId, (current) =>
      current.contentHash === contentHash ? { ...current, status: "failed" } : current,
    );
  }

  return saveListen(context, sourceId, (current) => current);
}

export async function readSourceListenAudio(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  passage: number,
  rangeHeader?: string | null,
): Promise<Response> {
  const source = await requireSourceAccess(context, userId, sourceId);

  if (!readSourceRecordListen(source)?.passages[passage]?.audio) {
    throw new AssistantError("That passage isn't ready yet", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateObjectResponse(
    context,
    passageKey(sourceId, passage),
    { filename: `passage-${passage + 1}.mp3`, mimeType: "audio/mpeg" },
    rangeHeader,
  );
}
