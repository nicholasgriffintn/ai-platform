import { describe, expect, it, vi } from "vitest";

import { isSandboxError } from "../errors.js";
import { createLeaseFence } from "../lease-fence.js";
import { decideContainerEgress } from "../outbound.js";
import { signGrant, verifyGrant } from "../signed-grant.js";

describe("createLeaseFence", () => {
  function fakeStore(initial: number | null) {
    let value = initial;

    return {
      store: {
        read: async () => value,
        write: vi.fn(async (fence: number) => void (value = fence)),
      },
      current: () => value,
    };
  }

  it("rejects stale fences and advances the stored fence for newer ones", async () => {
    const { store, current } = fakeStore(3);
    const fence = createLeaseFence(store);

    await expect(fence.assert(2)).rejects.toSatisfy((error) =>
      isSandboxError(error, "stale_lease"),
    );
    await fence.assert(3);
    expect(store.write).not.toHaveBeenCalled();
    await fence.assert(5);
    expect(current()).toBe(5);
    await expect(fence.assert(0)).rejects.toSatisfy((error) =>
      isSandboxError(error, "invalid_lease"),
    );
  });
});

describe("outbound policy", () => {
  it("lets containers read registries without letting them publish or reach other hosts", () => {
    const policy = {
      mode: "list" as const,
      hosts: ["api.example.com"],
      readOnlyHosts: ["registry.npmjs.org"],
    };
    const decide = (url: string, method: string) =>
      decideContainerEgress(policy, { url: new URL(url), method }).kind;

    expect(decide("https://registry.npmjs.org/react", "GET")).toBe("allow");
    expect(decide("https://registry.npmjs.org/react", "PUT")).toBe("block");
    expect(decide("https://api.example.com/v1", "POST")).toBe("allow");
    expect(decide("https://evil.com/", "GET")).toBe("block");
    expect(decide("ftp://registry.npmjs.org/", "GET")).toBe("block");
    expect(
      decideContainerEgress(
        { mode: "all", hosts: [], readOnlyHosts: [] },
        { url: new URL("https://evil.com/"), method: "POST" },
      ).kind,
    ).toBe("allow");
  });
});

describe("signed grants", () => {
  it("round-trips claims and rejects tampering and expiry", async () => {
    const token = await signGrant("secret", { exp: 2_000, resourceId: "r1" });
    const accept = (claims: Record<string, unknown>) =>
      typeof claims.resourceId === "string"
        ? { exp: Number(claims.exp), resourceId: claims.resourceId }
        : null;

    await expect(verifyGrant("secret", token, accept, () => 1_000)).resolves.toEqual({
      exp: 2_000,
      resourceId: "r1",
    });
    await expect(verifyGrant("secret", token, accept, () => 3_000)).resolves.toBeNull();
    await expect(verifyGrant("other", token, accept, () => 1_000)).resolves.toBeNull();
    await expect(verifyGrant("secret", `${token}x`, accept, () => 1_000)).resolves.toBeNull();
  });
});
