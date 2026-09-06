import type { RecordingListItem } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { safeParseJson } from "../../../utils/json";

export interface IRecordingListRequest {
  context?: ServiceContext;
  env?: IEnv;
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

export const handleRecordingList = async (
  req: IRecordingListRequest,
): Promise<RecordingListItem[]> => {
  const { env, context, user, projectId } = req;

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repositories = serviceContext.repositories;

  const appDataList = projectId
    ? await repositories.outputs.listProjectOutputs(projectId, "recordings")
    : await repositories.outputs.listPersonalOutputs(user.id, "recordings");

  if (!appDataList || appDataList.length === 0) {
    return [];
  }

  const recordingMap = new Map<string, RecordingItem>();

  for (const appData of appDataList) {
    if (!appData.group_id) {
      continue;
    }

    const itemId = appData.group_id;
    const itemType = appData.kind;
    const data = safeParseJson<Record<string, any>>(appData.content) ?? {};

    if (!recordingMap.has(itemId)) {
      recordingMap.set(itemId, { id: itemId, items: {} });
    }

    const recording = recordingMap.get(itemId);

    if (!recording.items) {
      recording.items = {};
    }

    if (!recording.items[itemType]) {
      recording.items[itemType] = [];
    }

    recording.items[itemType]!.push({ data });
  }

  const recordings = Array.from(recordingMap.values()).map((recording) => {
    const uploads = recording.items?.upload || [];
    const transcriptions = recording.items?.transcribe || [];
    const summaries = recording.items?.summary || [];
    const images = recording.items?.image || [];

    let status = "processing" as RecordingListItem["status"];

    if (images.length > 0) {
      status = "complete";
    } else if (summaries.length > 0) {
      status = "summarizing";
    } else if (transcriptions.length > 0) {
      status = "transcribing";
    }

    const uploadData = uploads[0]?.data || {};

    return {
      id: recording.id,
      title: uploadData.title || "Untitled Recording",
      createdAt: uploadData.createdAt || new Date().toISOString(),
      imageUrl: images[0]?.data?.imageUrl,
      duration: uploadData.duration,
      status,
    };
  });

  return recordings;
};
