import { describe, expect, it } from "vitest";

import { base64ToBuffer } from "../base64.js";
import { deriveEd25519SigningKey, signEd25519 } from "../crypto.js";

const secret = new Uint8Array(32).fill(7);

describe("deriveEd25519SigningKey", () => {
  it("derives the same public key from the same secret and a different one per purpose", async () => {
    const first = await deriveEd25519SigningKey(secret, "polychat-aip-signing-v1");
    const again = await deriveEd25519SigningKey(secret, "polychat-aip-signing-v1");
    const other = await deriveEd25519SigningKey(secret, "another-purpose");

    expect(again.publicKey).toBe(first.publicKey);
    expect(other.publicKey).not.toBe(first.publicKey);
  });

  it("produces signatures that verify against the published public key", async () => {
    const key = await deriveEd25519SigningKey(secret, "polychat-aip-signing-v1");
    const signature = await signEd25519(key.privateKey, '{"memory":[]}');
    const publicKey = await crypto.subtle.importKey(
      "raw",
      base64ToBuffer(key.publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const message = new TextEncoder().encode('{"memory":[]}');

    expect(
      await crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        base64ToBuffer(signature),
        message,
      ),
    ).toBe(true);
    expect(
      await crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        base64ToBuffer(signature),
        new TextEncoder().encode('{"memory":[1]}'),
      ),
    ).toBe(false);
  });

  it("refuses a secret too short to sign with", async () => {
    await expect(deriveEd25519SigningKey(new Uint8Array(16), "x")).rejects.toThrow(
      "at least 32 bytes",
    );
  });
});
