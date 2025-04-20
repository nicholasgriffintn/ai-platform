import { AwsClient } from "aws4fetch";

import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export type UploadRequest = {
  env: IEnv;
  request: {
    audioUrl?: string;
  };
  user: IUser;
  conversationManager?: ConversationManager;
};

interface IPodcastUploadResponse extends IFunctionResponse {
  completion_id?: string;
}

export const handlePodcastUpload = async (
  req: UploadRequest,
): Promise<IPodcastUploadResponse> => {
  const { env, request, user, conversationManager } = req;

  const podcastId = Math.random().toString(36);

  if (!conversationManager) {
    throw new AssistantError(
      "Missing conversation manager",
      ErrorType.PARAMS_ERROR,
    );
  }

  await conversationManager.add(podcastId, {
    role: "user",
    content: "Generate a podcast record with a transcription",
    app: "podcasts",
  });

  if (!request.audioUrl) {
    const imageKey = `podcasts/${podcastId}/recording.mp3`;
    const bucketName = env.PUBLIC_ASSETS_BUCKET || "assistant-assets";
    const accountId = env.ACCOUNT_ID;

    const url = new URL(
      `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`,
    );
    url.pathname = imageKey;
    url.searchParams.set("X-Amz-Expires", "3600");

    const r2 = new AwsClient({
      accessKeyId: env.ASSETS_BUCKET_ACCESS_KEY_ID,
      secretAccessKey: env.ASSETS_BUCKET_SECRET_ACCESS_KEY,
    });

    const signed = await r2.sign(
      new Request(url, {
        method: "PUT",
      }),
      {
        aws: { signQuery: true },
      },
    );

    if (!signed) {
      throw new AssistantError("Failed to sign request");
    }

    const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
    const message = {
      role: "assistant" as ChatRole,
      content: `Podcast Uploaded: [Listen Here](${baseAssetsUrl}/${imageKey})`,
      name: "podcast_upload",
      data: {
        imageKey,
        url,
        signedUrl: signed.url,
      },
    };
    const response = await conversationManager.add(podcastId, message);

    return {
      ...response,
      completion_id: podcastId,
    };
  }

  const message = {
    role: "assistant" as ChatRole,
    content: `Podcast Uploaded [Listen Here](${request.audioUrl})`,
    name: "podcast_upload",
    data: {
      url: request.audioUrl,
    },
  };
  const response = await conversationManager.add(podcastId, message);

  return {
    ...response,
    completion_id: podcastId,
  };
};
