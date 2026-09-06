import type { Recording } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { safeParseJson } from "../../../utils/json";

export interface IRecordingDetailRequest {
  context?: ServiceContext;
  env?: IEnv;
  recordingId: string;
  user: IUser;
  projectId?: string;
}

interface RecordingItem {
  id: string;
  items?: {
    upload?: Array<{ data: Record<string, any> }>;
    transcribe?: Array<{ data: Record<string, any> }>;
    summary?: Array<{ data: Record<string, any> }>;
    image?: Array<{ data: Record<string, any> }>;
  };
}

export const handleRecordingDetail = async (req: IRecordingDetailRequest): Promise<Recording> => {
  const { env, context, recordingId, user, projectId } = req;

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repositories = serviceContext.repositories;

  const appDataItems = projectId
    ? await repositories.outputs.listProjectOutputGroup(projectId, "recordings", recordingId)
    : await repositories.outputs.listPersonalOutputGroup(user.id, "recordings", recordingId);

  if (!appDataItems || appDataItems.length === 0) {
    throw new AssistantError("Recording not found", ErrorType.NOT_FOUND);
  }

  const recordingData: RecordingItem = { id: recordingId, items: {} };

  for (const appData of appDataItems) {
    const itemType = appData.kind;
    const data = safeParseJson<Record<string, any>>(appData.content) ?? {};

    if (!recordingData.items) {
      recordingData.items = {};
    }

    if (!recordingData.items[itemType]) {
      recordingData.items[itemType] = [];
    }

    recordingData.items[itemType]!.push({ data });
  }

  const uploads = recordingData.items?.upload || [];
  const transcriptions = recordingData.items?.transcribe || [];
  const summaries = recordingData.items?.summary || [];
  const images = recordingData.items?.image || [];

  let status = "processing" as Recording["status"];

  if (images.length > 0) {
    status = "complete";
  } else if (summaries.length > 0) {
    status = "summarizing";
  } else if (transcriptions.length > 0) {
    status = "transcribing";
  }

  const uploadData = uploads[0]?.data || {};

  const recording: Recording = {
    id: recordingData.id,
    title: uploadData.title || "Untitled Recording",
    description: uploadData.description,
    createdAt: uploadData.createdAt || new Date().toISOString(),
    imageUrl: images.length > 0 ? images[0].data.imageUrl : undefined,
    audioUrl: uploadData.audioUrl,
    duration: uploadData.duration,
    transcript:
      transcriptions.length > 0 ? transcriptions[0].data?.transcriptionData?.output : undefined,
    summary: summaries.length > 0 ? summaries[0].data.summary : undefined,
    status,
  };

  return recording;
};
