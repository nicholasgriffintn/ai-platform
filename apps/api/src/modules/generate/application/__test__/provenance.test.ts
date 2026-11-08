import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { readMediaProvenance } from "@ngriffin_uk/polychat-utility-server/media-provenance";
import { describe, expect, it } from "vitest";

import { getProvenanceKeys, markForDelivery } from "../provenance";

const MP3 = Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);
const origin = { mimeType: "audio/mpeg", model: "acme/voice", provider: "acme" };

async function signingKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  return bufferToBase64(await crypto.subtle.exportKey("pkcs8", privateKey));
}

describe("markForDelivery", () => {
  it("signs with the configured key and publishes the matching public key", async () => {
    const env = { PROVENANCE_SIGNING_KEY: await signingKey() };
    const data = await markForDelivery({ env, bucket: undefined, data: MP3, origin });
    const [key] = await getProvenanceKeys(env);

    expect(readMediaProvenance(data)?.keyId).toBe(key?.kid);
    expect(readMediaProvenance(data)?.signature).toHaveLength(86);
    expect(key).not.toHaveProperty("d");
  });
});
