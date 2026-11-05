import type { R2Bucket } from "@cloudflare/workers-types";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { readMediaProvenance } from "@ngriffin_uk/polychat-utility-server/media-provenance";
import { describe, expect, it, vi } from "vitest";

import {
  findMediaFingerprint,
  getProvenanceKeys,
  markForDelivery,
  recordOversizedMedia,
} from "../provenance";

const MP3 = Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);
const origin = { mimeType: "audio/mpeg", model: "acme/voice", provider: "acme" };

function fakeBucket({ failWrites = false } = {}) {
  const objects = new Map<string, string>();
  const bucket = {
    put: vi.fn(async (key: string, value: string) => {
      if (failWrites) {
        throw new Error("Bucket unavailable");
      }

      objects.set(key, value);
    }),
    get: vi.fn(async (key: string) => {
      const value = objects.get(key);

      return value === undefined ? null : { json: async () => JSON.parse(value) };
    }),
  };

  return { bucket: bucket as unknown as R2Bucket, objects };
}

async function signingKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  return bufferToBase64(await crypto.subtle.exportKey("pkcs8", privateKey));
}

async function fingerprintOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("recordOversizedMedia", () => {
  it("puts streamed media on record as too large to mark", async () => {
    const { bucket } = fakeBucket();

    await recordOversizedMedia({
      bucket,
      body: new Blob([MP3]).stream(),
      origin,
    });

    expect(await findMediaFingerprint(bucket, await fingerprintOf(MP3))).toMatchObject({
      status: "too-large",
      container: null,
      model: "acme/voice",
    });
  });
});

describe("markForDelivery", () => {
  it("records the delivered file so its hash can be looked up", async () => {
    const { bucket } = fakeBucket();
    const data = await markForDelivery({ env: {}, bucket, data: MP3, origin });
    const entry = await findMediaFingerprint(bucket, await fingerprintOf(data));

    expect(entry).toMatchObject({ status: "marked", model: "acme/voice", provider: "acme" });
    expect(JSON.stringify(entry)).not.toMatch(/user|email/i);
  });

  it("signs with the configured key and publishes the matching public key", async () => {
    const env = { PROVENANCE_SIGNING_KEY: await signingKey() };
    const data = await markForDelivery({ env, bucket: undefined, data: MP3, origin });
    const [key] = await getProvenanceKeys(env);

    expect(readMediaProvenance(data)?.keyId).toBe(key?.kid);
    expect(readMediaProvenance(data)?.signature).toHaveLength(86);
    expect(key).not.toHaveProperty("d");
  });

  it("still marks when the signing key is unusable", async () => {
    const env = { PROVENANCE_SIGNING_KEY: "bm90LWEta2V5" };
    const data = await markForDelivery({ env, bucket: undefined, data: MP3, origin });

    expect(readMediaProvenance(data)?.signature).toBeUndefined();
    expect(await getProvenanceKeys(env)).toEqual([]);
  });

  it("delivers the mark even when the fingerprint cannot be recorded", async () => {
    const { bucket } = fakeBucket({ failWrites: true });
    const data = await markForDelivery({ env: {}, bucket, data: MP3, origin });

    expect(readMediaProvenance(data)).not.toBeNull();
  });
});
