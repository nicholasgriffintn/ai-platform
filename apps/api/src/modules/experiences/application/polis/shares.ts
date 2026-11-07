import {
  POLIS_SHARE_MAX_BYTES,
  polisRecordingSchema,
  type PolisRecording,
  type PolisShare,
} from "@ngriffin_uk/polychat-schemas";
import { randomHex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { IEnv, IUser } from "~/types";

const SHARE_TOKEN_LENGTH = 32;
const SHARE_PREFIX = "polis/shares/";

function bucket(env: IEnv): R2Bucket {
  if (!env.PRIVATE_ASSETS_BUCKET) {
    throw new AssistantError("Sharing is not set up here", ErrorType.CONFIGURATION_ERROR, 503);
  }

  return env.PRIVATE_ASSETS_BUCKET;
}

function shareKey(token: string): string {
  return `${SHARE_PREFIX}${token}.json`;
}

function notFound(): AssistantError {
  return new AssistantError("This town is not shared any more", ErrorType.NOT_FOUND, 404);
}

export async function sharePolisTown(
  env: IEnv,
  user: IUser,
  recording: PolisRecording,
): Promise<PolisShare> {
  const body = JSON.stringify(recording);

  if (new TextEncoder().encode(body).byteLength > POLIS_SHARE_MAX_BYTES) {
    throw new AssistantError(
      "This town has too much history to share. Share an earlier save instead.",
      ErrorType.PARAMS_ERROR,
      413,
    );
  }

  const token = randomHex(SHARE_TOKEN_LENGTH).toLowerCase();

  await bucket(env).put(shareKey(token), body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { owner: String(user.id), name: recording.name },
  });

  return { token };
}

export async function readSharedPolisTown(env: IEnv, token: string): Promise<PolisRecording> {
  const object = await bucket(env).get(shareKey(token));

  if (!object) {
    throw notFound();
  }

  const parsed = polisRecordingSchema.safeParse(safeParseJson(await object.text()));

  if (!parsed.success) {
    throw notFound();
  }

  return parsed.data;
}

export async function stopSharingPolisTown(
  env: IEnv,
  user: IUser,
  token: string,
): Promise<PolisShare> {
  const store = bucket(env);
  const object = await store.head(shareKey(token));

  if (!object || object.customMetadata?.owner !== String(user.id)) {
    throw notFound();
  }

  await store.delete(shareKey(token));

  return { token };
}
