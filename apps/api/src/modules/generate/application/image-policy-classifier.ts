import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DECISION_MEDIA_MAX_BYTES,
  DECISION_MEDIA_MAX_ITEMS,
  DECISION_MEDIA_TYPES,
} from "@ngriffin_uk/polychat-schemas";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { detectContainer } from "@ngriffin_uk/polychat-utility-server/media-provenance";

import { ai } from "~/infrastructure/ai";
import { createMetrics } from "~/infrastructure/telemetry";
import {
  GENERATED_IMAGE_REVIEW,
  IMAGE_POLICY_CLASSIFIER,
  IMAGE_POLICY_QUESTIONS,
  IMAGE_POLICY_REFUSAL,
  IMAGE_POLICY_UNAVAILABLE,
  readImagePolicyViolations,
  type ImagePolicyViolation,
} from "~/modules/generate/domain/image-policy";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "generate/image-policy" });

const CLASSIFIER_IMAGE_EDGE = 1536;
const CONTAINER_IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export type ImagePolicySurface =
  | "chat"
  | "create_image"
  | "create_video"
  | "drawing"
  | "generated_output"
  | "sources";

export interface ImagePolicyTurn {
  role: string;
  text: string;
}

export interface ClassifiedImagePolicyRequest {
  env: IEnv;
  user?: IUser;
  completionId?: string;
  surface: ImagePolicySurface;
  text: string;
  history?: readonly ImagePolicyTurn[];
  images?: readonly string[];
  videos?: readonly string[];
}

function unavailable(request: Pick<ClassifiedImagePolicyRequest, "surface">, error: unknown) {
  logger.error("Image policy check failed", {
    surface: request.surface,
    errorType: error instanceof AssistantError ? error.type : "unknown",
  });

  return new AssistantError(IMAGE_POLICY_UNAVAILABLE, ErrorType.PROVIDER_ERROR, 503);
}

async function classify(request: ClassifiedImagePolicyRequest): Promise<ImagePolicyViolation[]> {
  const { history = [], images = [], videos = [] } = request;
  const media = [
    ...chunkArray(images, DECISION_MEDIA_MAX_ITEMS.images).map((batch) => ({ images: batch })),
    ...videos.map((video) => ({ videos: [video] })),
  ];
  const decisions = await Promise.all(
    (media.length > 0 ? media : [{}]).map((item) =>
      ai.decide({
        env: request.env,
        user: request.user,
        completion_id: request.completionId,
        ...IMAGE_POLICY_CLASSIFIER,
        state: {
          request: request.text,
          ...(history.length > 0 ? { earlier_turns: history.map((turn) => ({ ...turn })) } : {}),
        },
        questions: IMAGE_POLICY_QUESTIONS,
        ...item,
      }),
    ),
  );

  return [...new Set(decisions.flatMap(({ answers }) => readImagePolicyViolations(answers)))];
}

export async function enforceClassifiedImagePolicy(
  request: ClassifiedImagePolicyRequest,
): Promise<void> {
  let violations: ImagePolicyViolation[];

  try {
    violations = await classify(request);
  } catch (error) {
    throw unavailable(request, error);
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

async function shrinkForClassifier(env: IEnv, data: Uint8Array): Promise<string> {
  if (!env.IMAGES) {
    throw new AssistantError(
      "The image is too large for the classifier and no Images binding is configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const result = await env.IMAGES.input(new Blob([Uint8Array.from(data)]).stream())
    .transform({ width: CLASSIFIER_IMAGE_EDGE, height: CLASSIFIER_IMAGE_EDGE, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: 85 });
  const shrunk = await new Response(result.image()).arrayBuffer();

  return `data:image/jpeg;base64,${bufferToBase64(shrunk)}`;
}

export async function toClassifierImage(
  env: IEnv,
  data: ArrayBuffer | Uint8Array,
  mimeType: string | undefined,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const type =
    CONTAINER_IMAGE_TYPES[detectContainer(bytes) ?? ""] ??
    mimeType?.split(";")[0]?.trim().toLowerCase().replace("image/jpg", "image/jpeg");
  const accepted: readonly string[] = DECISION_MEDIA_TYPES.images;

  if (type && accepted.includes(type) && bytes.byteLength <= DECISION_MEDIA_MAX_BYTES.images) {
    return `data:${type};base64,${bufferToBase64(Uint8Array.from(bytes).buffer)}`;
  }

  return shrinkForClassifier(env, bytes);
}

function isImageMedia(bytes: Uint8Array, mimeType: string | undefined): boolean {
  return (
    mimeType?.toLowerCase().startsWith("image/") === true ||
    CONTAINER_IMAGE_TYPES[detectContainer(bytes) ?? ""] !== undefined
  );
}

export async function screenGeneratedImage({
  env,
  user,
  completionId,
  surface = "generated_output",
  data,
  mimeType,
}: {
  env: IEnv | undefined;
  user?: IUser;
  completionId?: string;
  surface?: ImagePolicySurface;
  data: ArrayBuffer | Uint8Array;
  mimeType?: string;
}): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (!isImageMedia(bytes, mimeType)) {
    return;
  }

  if (!env) {
    throw unavailable({ surface }, null);
  }

  let image: string;

  try {
    image = await toClassifierImage(env, bytes, mimeType);
  } catch (error) {
    throw unavailable({ surface }, error);
  }

  await enforceClassifiedImagePolicy({
    env,
    user,
    completionId,
    surface,
    text: GENERATED_IMAGE_REVIEW,
    images: [image],
  });
}
