import { teachingRecordingIdSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);

  const result = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(result);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return result;
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signScreenAccess(
  secret: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(encoded),
  );

  return `${encoded}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export interface ScreenAccessPayload {
  origin: string;
  resourceId: string;
  fence: number;
  exp: number;
  recordingId?: string;
}

export async function verifyScreenAccess(
  secret: string,
  token: string,
  origin: string,
): Promise<ScreenAccessPayload | null> {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    decodeBase64Url(signature),
    new TextEncoder().encode(encoded),
  );

  if (!valid) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));

    if (!isRecord(payload)) {
      return null;
    }

    if (
      payload.origin !== origin ||
      typeof payload.resourceId !== "string" ||
      typeof payload.fence !== "number" ||
      !Number.isSafeInteger(payload.fence) ||
      payload.fence <= 0 ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      (payload.recordingId !== undefined &&
        !teachingRecordingIdSchema.safeParse(payload.recordingId).success)
    ) {
      return null;
    }

    return {
      origin,
      resourceId: payload.resourceId,
      fence: payload.fence,
      exp: payload.exp,
      ...(typeof payload.recordingId === "string" ? { recordingId: payload.recordingId } : {}),
    };
  } catch {
    return null;
  }
}
