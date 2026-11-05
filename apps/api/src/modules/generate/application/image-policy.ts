import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DECISION_MEDIA_MAX_BYTES,
  DECISION_MEDIA_TYPES,
  decisionMediaDecodedBytes,
  isDecisionMediaDataUrl,
} from "@ngriffin_uk/polychat-schemas";
import { base64ToBuffer, bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchFollowingSafeRedirects } from "@ngriffin_uk/polychat-utility-server/http";

import { StorageService } from "~/infrastructure/storage";
import {
  IMAGE_POLICY_UNAVAILABLE,
  REFERENCE_VIDEO_UNREADABLE,
} from "~/modules/generate/domain/image-policy";

import {
  enforceClassifiedImagePolicy,
  toClassifierImage,
  type ClassifiedImagePolicyRequest,
} from "./image-policy-classifier";

export type { ImagePolicySurface, ImagePolicyTurn } from "./image-policy-classifier";

const logger = getLogger({ prefix: "generate/image-policy" });

export type ImagePolicyRequest = ClassifiedImagePolicyRequest;

async function loadImage(request: ImagePolicyRequest, image: string): Promise<string> {
  if (isDecisionMediaDataUrl(image, "images")) {
    if (decisionMediaDecodedBytes(image) <= DECISION_MEDIA_MAX_BYTES.images) {
      return image;
    }

    return toClassifierImage(request.env, base64ToBuffer(image.slice(image.indexOf(",") + 1)), "");
  }

  const blob = await StorageService.forPrivateAssetsEnv(request.env).downloadFile(
    image,
    request.user?.id,
  );

  return toClassifierImage(request.env, await blob.arrayBuffer(), blob.type);
}

async function fetchVideo(video: string): Promise<string> {
  const response = await fetchFollowingSafeRedirects(video);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const accepted: readonly string[] = DECISION_MEDIA_TYPES.videos;

  if (!response.ok || !mimeType || !accepted.includes(mimeType)) {
    throw new Error("The reference video is not a readable MP4 or WebM file");
  }

  const data = await response.arrayBuffer();

  if (data.byteLength > DECISION_MEDIA_MAX_BYTES.videos) {
    throw new Error("The reference video is too large to classify");
  }

  return `data:${mimeType};base64,${bufferToBase64(data)}`;
}

async function loadVideo(request: ImagePolicyRequest, video: string): Promise<string> {
  if (isDecisionMediaDataUrl(video, "videos")) {
    if (decisionMediaDecodedBytes(video) > DECISION_MEDIA_MAX_BYTES.videos) {
      throw new Error("The reference video is too large to classify");
    }

    return video;
  }

  const stored = await StorageService.forPrivateAssetsEnv(request.env).getPrivateAssetDataUrl(
    video,
    request.user?.id,
    undefined,
    {
      allowedMimeTypes: [...DECISION_MEDIA_TYPES.videos],
      maxBytes: DECISION_MEDIA_MAX_BYTES.videos,
    },
  );

  return stored ?? fetchVideo(video);
}

function refuseUnreadable(request: ImagePolicyRequest, message: string, statusCode: number) {
  return (error: unknown): never => {
    logger.warn("Reference media could not be classified", {
      surface: request.surface,
      errorType: error instanceof AssistantError ? error.type : "unknown",
    });

    throw new AssistantError(
      message,
      statusCode === 400 ? ErrorType.PARAMS_ERROR : ErrorType.PROVIDER_ERROR,
      statusCode,
    );
  };
}

export async function enforceImagePolicy(request: ImagePolicyRequest): Promise<void> {
  const [images, videos] = await Promise.all([
    Promise.all((request.images ?? []).map((image) => loadImage(request, image))).catch(
      refuseUnreadable(request, IMAGE_POLICY_UNAVAILABLE, 503),
    ),
    Promise.all((request.videos ?? []).map((video) => loadVideo(request, video))).catch(
      refuseUnreadable(request, REFERENCE_VIDEO_UNREADABLE, 400),
    ),
  ]);

  await enforceClassifiedImagePolicy({ ...request, images, videos });
}
