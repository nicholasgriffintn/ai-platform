import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { DECISION_MEDIA_MAX_ITEMS, isDecisionMediaDataUrl } from "@ngriffin_uk/polychat-schemas";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import { StorageService } from "~/infrastructure/storage";
import { createMetrics } from "~/infrastructure/telemetry";
import {
  IMAGE_POLICY_CLASSIFIER,
  IMAGE_POLICY_QUESTIONS,
  IMAGE_POLICY_REFUSAL,
  IMAGE_POLICY_UNAVAILABLE,
  readImagePolicyViolations,
  type ImagePolicyViolation,
} from "~/modules/generate/domain/image-policy";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "generate/image-policy" });

export type ImagePolicySurface = "chat" | "create_image" | "create_video" | "drawing" | "sources";

export interface ImagePolicyRequest {
  env: IEnv;
  user?: IUser;
  completionId?: string;
  surface: ImagePolicySurface;
  text: string;
  images?: readonly string[];
}

async function toClassifierImage(request: ImagePolicyRequest, image: string): Promise<string> {
  if (isDecisionMediaDataUrl(image, "images")) {
    return image;
  }

  const blob = await StorageService.forPrivateAssetsEnv(request.env).downloadFile(
    image,
    request.user?.id,
  );
  const mimeType = blob.type.toLowerCase().replace("image/jpg", "image/jpeg");

  return `data:${mimeType};base64,${bufferToBase64(await blob.arrayBuffer())}`;
}

async function classify(request: ImagePolicyRequest): Promise<ImagePolicyViolation[]> {
  const images = await Promise.all(
    (request.images ?? []).map((image) => toClassifierImage(request, image)),
  );
  const batches = images.length > 0 ? chunkArray(images, DECISION_MEDIA_MAX_ITEMS.images) : [[]];
  const decisions = await Promise.all(
    batches.map((batch) =>
      ai.decide({
        env: request.env,
        user: request.user,
        completion_id: request.completionId,
        ...IMAGE_POLICY_CLASSIFIER,
        state: { request: request.text },
        questions: IMAGE_POLICY_QUESTIONS,
        ...(batch.length > 0 ? { images: batch } : {}),
      }),
    ),
  );

  return [...new Set(decisions.flatMap(({ answers }) => readImagePolicyViolations(answers)))];
}

export async function enforceImagePolicy(request: ImagePolicyRequest): Promise<void> {
  let violations: ImagePolicyViolation[];

  try {
    violations = await classify(request);
  } catch (error) {
    logger.error("Image policy check failed", {
      surface: request.surface,
      errorType: error instanceof AssistantError ? error.type : "unknown",
    });

    throw new AssistantError(IMAGE_POLICY_UNAVAILABLE, ErrorType.PROVIDER_ERROR, 503);
  }

  if (violations.length === 0) {
    return;
  }

  createMetrics(request.env).trackGuardrailViolation(
    "image_policy_violation",
    { provider: IMAGE_POLICY_CLASSIFIER.provider, surface: request.surface, violations },
    {
      userId: request.user?.id,
      email: request.user?.email,
      planId: request.user?.plan_id,
    },
    request.completionId,
  );

  throw new AssistantError(IMAGE_POLICY_REFUSAL, ErrorType.FORBIDDEN, 403);
}
