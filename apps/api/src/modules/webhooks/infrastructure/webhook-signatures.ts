const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);

    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function getVersionedSignatures(
  signatureHeader: string,
  version: string,
): Uint8Array<ArrayBuffer>[] {
  return signatureHeader
    .split(/\s+/)
    .map((signature) => signature.split(",", 2))
    .filter(([candidateVersion, value]) => candidateVersion === version && Boolean(value))
    .map(([, value]) => decodeBase64(value ?? ""))
    .filter((value): value is Uint8Array<ArrayBuffer> => Boolean(value));
}

export async function verifyHmacSha256Webhook(params: {
  secret: string;
  webhookId: string;
  timestamp: string;
  payload: string;
  signature: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const secret = params.secret.trim();
  const webhookId = params.webhookId.trim();
  const timestamp = params.timestamp.trim();

  if (!secret || !webhookId || !timestamp || !params.signature.trim()) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  const toleranceSeconds = params.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;

  if (
    !Number.isSafeInteger(timestampSeconds) ||
    timestampSeconds <= 0 ||
    !Number.isFinite(toleranceSeconds) ||
    toleranceSeconds < 0 ||
    Math.abs((params.nowMs ?? Date.now()) - timestampSeconds * 1000) > toleranceSeconds * 1000
  ) {
    return false;
  }

  const receivedSignatures = getVersionedSignatures(params.signature, "v1");

  if (receivedSignatures.length === 0) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signingPayload = encoder.encode(`${webhookId}.${timestamp}.${params.payload}`);

    for (const received of receivedSignatures) {
      if (await crypto.subtle.verify("HMAC", key, received, signingPayload)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
