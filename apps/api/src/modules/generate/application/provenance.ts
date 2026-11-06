import type { R2Bucket } from "@cloudflare/workers-types";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  mediaProvenanceEntrySchema,
  type MediaProvenanceEntry,
  type MediaProvenanceKey,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { sha256Stream } from "@ngriffin_uk/polychat-utility-server/crypto";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  markGeneratedMedia,
  type GeneratedMediaOrigin,
  type MarkedMedia,
  type MediaProvenanceSigner,
} from "@ngriffin_uk/polychat-utility-server/media-provenance";

import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "generate/provenance" });
const GENERATOR = "Polychat";
const FINGERPRINT_PREFIX = "provenance/fingerprints/";
const KEY_ALGORITHM = { name: "ECDSA", namedCurve: "P-256" };

type ProvenanceEnv = Pick<IEnv, "PROVENANCE_SIGNING_KEY">;

interface LoadedSigningKey {
  privateKey: CryptoKey;
  publicKey: MediaProvenanceKey;
}

async function loadSigningKey(env: ProvenanceEnv | undefined): Promise<LoadedSigningKey | null> {
  if (!env?.PROVENANCE_SIGNING_KEY) {
    return null;
  }

  const pkcs8 = Uint8Array.from(
    base64ToBuffer(env.PROVENANCE_SIGNING_KEY.replace(/-----[A-Z ]+-----|\s/g, "")),
  );
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, KEY_ALGORITHM, true, ["sign"]);
  const { x, y } = await crypto.subtle.exportKey("jwk", privateKey);

  if (!x || !y) {
    throw new Error("The provenance signing key is not a P-256 key");
  }

  return {
    privateKey,
    publicKey: {
      kid: (await sha256Hex(`${x}.${y}`)).slice(0, 16),
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      use: "sig",
      x,
      y,
    },
  };
}

async function loadSigner(
  env: ProvenanceEnv | undefined,
): Promise<MediaProvenanceSigner | undefined> {
  try {
    const key = await loadSigningKey(env);

    if (!key) {
      return undefined;
    }

    return {
      keyId: key.publicKey.kid,
      sign: async (message) =>
        new Uint8Array(
          await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            key.privateKey,
            Uint8Array.from(message),
          ),
        ),
    };
  } catch (error) {
    logger.error("Provenance signing key could not be loaded", {
      error_message: getErrorMessage(error),
    });

    return undefined;
  }
}

async function recordFingerprint(
  bucket: R2Bucket,
  marked: Pick<MarkedMedia, "fingerprint" | "status" | "container" | "markId">,
  origin: GeneratedMediaOrigin,
): Promise<void> {
  const entry: MediaProvenanceEntry = {
    fingerprint: marked.fingerprint,
    status: marked.status,
    container: marked.container,
    markId: marked.markId,
    model: origin.model,
    provider: origin.provider,
    recordedAt: new Date().toISOString(),
  };

  try {
    await bucket.put(`${FINGERPRINT_PREFIX}${marked.fingerprint}.json`, JSON.stringify(entry), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch (error) {
    logger.error("Media fingerprint could not be recorded", {
      fingerprint: marked.fingerprint,
      error_message: getErrorMessage(error),
    });
  }
}

export async function markForDelivery(params: {
  env: ProvenanceEnv | undefined;
  bucket: R2Bucket | undefined;
  data: ArrayBuffer | Uint8Array;
  origin: GeneratedMediaOrigin;
}): Promise<Uint8Array<ArrayBuffer>> {
  const { bucket, data, env, origin } = params;

  try {
    const marked = await markGeneratedMedia(
      data,
      { ...origin, generator: GENERATOR },
      await loadSigner(env),
    );

    if (marked.status === "unsupported" || marked.status === "too-large") {
      logger.warn("Generated media was delivered without an embedded mark", {
        status: marked.status,
        mime_type: origin.mimeType,
        model: origin.model,
      });
    }

    if (bucket) {
      await recordFingerprint(bucket, marked, origin);
    }

    return marked.bytes;
  } catch (error) {
    logger.error("Generated media could not be marked", {
      mime_type: origin.mimeType,
      model: origin.model,
      error_message: getErrorMessage(error),
    });

    return new Uint8Array(data);
  }
}

export async function recordOversizedMedia(params: {
  bucket: R2Bucket;
  body: ReadableStream<Uint8Array>;
  origin: GeneratedMediaOrigin;
}): Promise<void> {
  const { body, bucket, origin } = params;

  logger.warn("Generated media was too large to mark", {
    mime_type: origin.mimeType,
    model: origin.model,
  });

  try {
    await recordFingerprint(
      bucket,
      { fingerprint: await sha256Stream(body), status: "too-large", container: null },
      origin,
    );
  } catch (error) {
    logger.error("Oversized media could not be fingerprinted", {
      error_message: getErrorMessage(error),
    });
  }
}

export async function getProvenanceKeys(env: ProvenanceEnv): Promise<MediaProvenanceKey[]> {
  const key = await loadSigningKey(env).catch(() => null);

  return key ? [key.publicKey] : [];
}

export async function findMediaFingerprint(
  bucket: R2Bucket,
  fingerprint: string,
): Promise<MediaProvenanceEntry | null> {
  const object = await bucket.get(`${FINGERPRINT_PREFIX}${fingerprint}.json`);

  return object ? mediaProvenanceEntrySchema.parse(await object.json()) : null;
}
