import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { createDeviceSyncGrant, resolveDeviceSyncGrant } from "../grant";

const env = { JWT_SECRET: "sync-test-secret-value-0123456789" } as IEnv;

describe("device sync grants", () => {
  it("resolves the user the grant was minted for", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      resolveDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-a" }),
    ).resolves.toEqual({ userId: 7 });
  });

  it("refuses a grant presented by another device", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      resolveDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-b" }),
    ).rejects.toThrow(/does not match/);
  });

  it("refuses a token that was not signed by this service", async () => {
    const other = { JWT_SECRET: "a-different-secret-value-9876543210" } as IEnv;
    const grant = await createDeviceSyncGrant(other, { userId: 7, deviceId: "device-a" });

    await expect(
      resolveDeviceSyncGrant({ env, grant: grant.token, deviceId: "device-a" }),
    ).rejects.toThrow(/Invalid or expired/);
  });

  it("refuses a grant when no signing secret is configured", async () => {
    const grant = await createDeviceSyncGrant(env, { userId: 7, deviceId: "device-a" });

    await expect(
      resolveDeviceSyncGrant({ env: {} as IEnv, grant: grant.token, deviceId: "device-a" }),
    ).rejects.toThrow(/not configured/);
  });

  it("refuses to mint a grant without a signing secret", async () => {
    await expect(
      createDeviceSyncGrant({} as IEnv, { userId: 7, deviceId: "device-a" }),
    ).rejects.toThrow(/not configured/);
  });
});
