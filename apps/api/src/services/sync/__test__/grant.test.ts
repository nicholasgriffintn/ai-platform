import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { assertDeviceSyncGrant, createDeviceSyncGrant } from "../grant";

const env = { JWT_SECRET: "sync-test-secret-value-0123456789" } as IEnv;

describe("device sync grants", () => {
  it("accepts a grant that matches the user and device", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      assertDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-a", userId: 7 }),
    ).resolves.toBeUndefined();
  });

  it("refuses a grant minted for another user", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      assertDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-a", userId: 8 }),
    ).rejects.toThrow(/does not match/);
  });

  it("refuses a grant minted for another device", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      assertDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-b", userId: 7 }),
    ).rejects.toThrow(/does not match/);
  });

  it("refuses a token that was not signed by this service", async () => {
    const other = { JWT_SECRET: "a-different-secret-value-9876543210" } as IEnv;
    const grant = await createDeviceSyncGrant(other, { userId: 7, deviceId: "device-a" });

    await expect(
      assertDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-a", userId: 7 }),
    ).rejects.toThrow(/Invalid or expired/);
  });

  it("refuses to mint a grant without a signing secret", async () => {
    await expect(
      createDeviceSyncGrant({} as IEnv, { userId: 7, deviceId: "device-a" }),
    ).rejects.toThrow(/not configured/);
  });
});
