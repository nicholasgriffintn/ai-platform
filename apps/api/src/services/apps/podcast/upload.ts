import { sanitiseInput } from "~/lib/chat/utils";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { StorageService, type StoredSourceFileResult } from "~/lib/storage";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export type UploadRequest = {
  context?: ServiceContext;
  env?: IEnv;
  request: {
    audio?: File;
    audioUrl?: string;
    title?: string;
    description?: string;
  };
  user: IUser;
  projectId?: string;
};

interface IPodcastUploadResponse extends IFunctionResponse {
  completion_id?: string;
}

export const handlePodcastUpload = async (req: UploadRequest): Promise<IPodcastUploadResponse> => {
  const { env, context, request, user, projectId } = req;

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  const serviceContext = resolveServiceContext({ context, env, user });

  serviceContext.ensureDatabase();
  const repositories = serviceContext.repositories;
  const podcastId = generateId();

  const sanitisedTitle = sanitiseInput(request.title);
  const sanitisedDescription = sanitiseInput(request.description);

  if (!request.audioUrl) {
    const podcastAudioKey = `podcasts/${podcastId}/recording.mp3`;

    if (!request.audio) {
      throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
    }

    let storedAudio: StoredSourceFileResult;
    let audioByteSize = 0;

    try {
      const arrayBuffer = await request.audio.arrayBuffer();

      audioByteSize = arrayBuffer.byteLength;

      storedAudio = await StorageService.forPrivateAssets(serviceContext).storeSourceFile({
        key: podcastAudioKey,
        data: arrayBuffer,
        createdByUserId: user.id,
        projectId,
        title: sanitisedTitle || request.audio.name || "Podcast recording",
        mimeType: "audio/mpeg",
        filename: "recording.mp3",
        byteSize: audioByteSize,
      });
    } catch {
      throw new AssistantError("Failed to upload podcast", ErrorType.UNKNOWN_ERROR);
    }

    const appData = {
      title: sanitisedTitle || "Untitled Podcast",
      description: sanitisedDescription,
      audioSourceId: storedAudio.sourceId,
      audioUrl: storedAudio.url,
      audioKey: podcastAudioKey,
      status: "ready",
      createdAt: new Date().toISOString(),
    };

    const output = await repositories.outputs.createOutput({
      createdByUserId: user.id,
      projectId,
      capabilityId: "podcasts",
      groupId: podcastId,
      kind: "upload",
      title: appData.title,
      content: appData,
      storageKey: podcastAudioKey,
      mimeType: "audio/mpeg",
      filename: "recording.mp3",
      byteSize: audioByteSize,
    });

    await repositories.outputs.attachSources(output.id, [storedAudio.sourceId]);

    return {
      status: "success",
      content: `Podcast Upload: [Listen Here](${storedAudio.url})`,
      completion_id: podcastId,
      data: appData,
    };
  }

  const appData = {
    title: sanitisedTitle || "Untitled Podcast",
    description: sanitisedDescription,
    audioUrl: request.audioUrl,
    status: "ready",
    createdAt: new Date().toISOString(),
  };

  await repositories.outputs.createOutput({
    createdByUserId: user.id,
    projectId,
    capabilityId: "podcasts",
    groupId: podcastId,
    kind: "upload",
    title: appData.title,
    content: appData,
  });

  return {
    status: "success",
    content: `Podcast Upload: [Listen Here](${request.audioUrl})`,
    completion_id: podcastId,
    data: appData,
  };
};
