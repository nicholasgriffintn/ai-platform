import type { PolisRecording } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { isPublicPolisRead } from "~/modules/experiences/api/polis";
import {
  readSharedPolisTown,
  sharePolisTown,
  stopSharingPolisTown,
} from "~/modules/experiences/application/polis/shares";
import type { IEnv, IUser } from "~/types";

function memoryBucket() {
  const objects = new Map<string, { body: string; customMetadata?: Record<string, string> }>();

  return {
    put: async (
      key: string,
      body: string,
      options?: { customMetadata?: Record<string, string> },
    ) => {
      objects.set(key, { body, customMetadata: options?.customMetadata });
    },
    get: async (key: string) => {
      const object = objects.get(key);

      return object ? { text: async () => object.body } : null;
    },
    head: async (key: string) => objects.get(key) ?? null,
    delete: async (key: string) => {
      objects.delete(key);
    },
  };
}

const recording: PolisRecording = {
  version: 1,
  id: "town-1",
  name: "Alderford",
  population: 1000,
  seed: 7,
  day: 400,
  savedAt: 1,
  log: [{ type: "parameters", day: 30, values: { rentCapPct: 3 } }],
};

const owner = { id: 1 } as IUser;
const stranger = { id: 2 } as IUser;

describe("polis shares", () => {
  it("lets anyone read a shared town but only the owner withdraw it", async () => {
    const env = { PRIVATE_ASSETS_BUCKET: memoryBucket() } as unknown as IEnv;
    const { token } = await sharePolisTown(env, owner, recording);

    await expect(readSharedPolisTown(env, token)).resolves.toEqual(recording);
    await expect(stopSharingPolisTown(env, stranger, token)).rejects.toMatchObject({
      statusCode: 404,
    });

    await stopSharingPolisTown(env, owner, token);
    await expect(readSharedPolisTown(env, token)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("only opens reads of shared towns to signed-out visitors", () => {
    const token = "0123456789abcdef0123456789abcdef";

    expect(isPublicPolisRead("GET", `/experiences/polis/shared/${token}`)).toBe(true);
    expect(isPublicPolisRead("DELETE", `/experiences/polis/shared/${token}`)).toBe(false);
    expect(isPublicPolisRead("GET", "/experiences/polis/shares")).toBe(false);
    expect(isPublicPolisRead("GET", `/experiences/polis/shared/${token}/extra`)).toBe(false);
    expect(isPublicPolisRead("POST", "/experiences/polis/decisions")).toBe(false);
  });
});
