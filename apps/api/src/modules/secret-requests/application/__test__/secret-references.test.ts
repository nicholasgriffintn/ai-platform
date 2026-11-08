import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { describe, expect, it } from "vitest";

import { createSecretReferenceRecord, verifySecretReference } from "../secret-references";

const env = {
  JWT_SECRET: "test-signing-secret",
  PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(7)),
};
const binding = { userId: 7, projectId: null, conversationId: "conversation-1" };
const now = new Date("2026-11-08T12:00:00.000Z");

async function issue() {
  return createSecretReferenceRecord(env, {
    ...binding,
    interactionId: "call-1",
    label: "Example API key",
    destination: "https://api.example.com",
    value: "sk_live_private_value",
    now,
  });
}

describe("verifySecretReference", () => {
  it("accepts the bound user, conversation and origin", async () => {
    const { record, reference } = await issue();

    expect(JSON.stringify(record)).not.toContain("sk_live_private_value");
    await expect(
      verifySecretReference(env, {
        record,
        binding,
        reference,
        destination: "https://api.example.com/v1/charges",
        now: now.toISOString(),
      }),
    ).resolves.toBe(record);
  });

  it("refuses another user, conversation or scope", async () => {
    const { record, reference } = await issue();

    for (const other of [
      { ...binding, userId: 8 },
      { ...binding, conversationId: "conversation-2" },
      { ...binding, projectId: "project-1" },
    ]) {
      await expect(
        verifySecretReference(env, {
          record,
          binding: other,
          reference,
          destination: "https://api.example.com",
          now: now.toISOString(),
        }),
      ).rejects.toThrow(/another conversation/);
    }
  });

  it("refuses any origin other than the one the user saw", async () => {
    const { record, reference } = await issue();

    for (const destination of [
      "https://attacker.example.net/collect",
      "http://api.example.com/v1",
      "https://api.example.com:8443/v1",
      "https://api.example.com.attacker.net/v1",
    ]) {
      await expect(
        verifySecretReference(env, {
          record,
          binding,
          reference,
          destination,
          now: now.toISOString(),
        }),
      ).rejects.toThrow("This secret can only be sent to https://api.example.com.");
    }
  });
});
