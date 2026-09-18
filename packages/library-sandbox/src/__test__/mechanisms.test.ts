import { describe, expect, it, vi } from "vitest";

import { renderToolProxySource, describeToolsForModel } from "../code-mode-source.js";
import { isSandboxError } from "../errors.js";
import { createExecutionControl } from "../execution-control.js";
import { createLeaseFence } from "../lease-fence.js";
import { decideOutbound, isHostAllowed, outboundNeedsGateway } from "../outbound.js";
import { signGrant, verifyGrant } from "../signed-grant.js";
import { workerCodeId } from "../worker-code.js";

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

  it("initialises an empty fence to one and revokes by bumping past the lease", async () => {
    const { store, current } = fakeStore(null);
    const fence = createLeaseFence(store);

    await expect(fence.ensureInitialised()).resolves.toBe(1);
    await fence.revoke(1);
    expect(current()).toBe(2);
    await fence.revoke(1);
    expect(store.write).toHaveBeenCalledTimes(2);
  });
});

describe("createExecutionControl", () => {
  it("times out against the deadline and cancels when the run control says so", async () => {
    let clock = 0;
    const states = [
      { state: "running" as const },
      { state: "cancelled" as const, cancellationReason: "user" },
    ];
    const control = createExecutionControl({
      timeoutMs: 1000,
      now: () => clock,
      control: { fetchState: async () => states.shift() ?? null },
    });

    await control.checkpoint("stop");
    clock = 2000;
    await expect(control.checkpoint("stop")).rejects.toSatisfy((error) =>
      isSandboxError(error, "timeout"),
    );

    const cancelling = createExecutionControl({
      now: () => 0,
      control: { fetchState: async () => ({ state: "cancelled", cancellationReason: "user" }) },
    });

    await expect(cancelling.checkpoint("stop")).rejects.toMatchObject({
      code: "cancelled",
      message: "user",
    });
  });

  it("waits while paused, reports heartbeats, and resumes", async () => {
    let clock = 0;
    const snapshots = [
      { state: "paused" as const, pauseReason: "hold" },
      { state: "paused" as const },
      { state: "running" as const },
    ];
    const onPaused = vi.fn();
    const onResumed = vi.fn();
    const control = createExecutionControl({
      now: () => clock,
      sleep: async (ms) => void (clock += ms),
      pausePollIntervalMs: 100,
      controlStateMinRefreshMs: 0,
      control: { fetchState: async () => snapshots.shift() ?? { state: "running" } },
      onPaused,
      onResumed,
    });

    await control.checkpoint("stop");

    expect(onPaused).toHaveBeenCalledWith("hold");
    expect(onResumed).toHaveBeenCalledOnce();
    expect(clock).toBe(200);
  });
});

describe("outbound policy", () => {
  it("matches hosts against exact and wildcard allowlists", () => {
    expect(isHostAllowed("api.example.com", ["api.example.com"])).toBe(true);
    expect(isHostAllowed("a.b.example.com", ["*.example.com"])).toBe(true);
    expect(isHostAllowed("example.com", ["*.example.com"])).toBe(false);
    expect(isHostAllowed("evil.com", "none")).toBe(false);
    expect(isHostAllowed("evil.com", "all")).toBe(true);
  });

  it("routes tool calls, allows listed hosts and blocks the rest", () => {
    const props = { allowlist: ["api.example.com"] as const, invocationId: "inv-1" };

    expect(decideOutbound(props, new URL("https://tools.polychat.invalid/web_search"))).toEqual({
      kind: "tool",
      tool: "web_search",
    });
    expect(decideOutbound(props, new URL("https://api.example.com/v1"))).toEqual({ kind: "allow" });
    expect(decideOutbound(props, new URL("https://evil.com/"))).toMatchObject({ kind: "block" });
    expect(
      decideOutbound({ allowlist: "all" }, new URL("https://tools.polychat.invalid/x")),
    ).toMatchObject({ kind: "block" });
    expect(outboundNeedsGateway({ allowlist: "all" })).toBe(false);
    expect(outboundNeedsGateway({ allowlist: "none" })).toBe(false);
    expect(outboundNeedsGateway({ allowlist: ["a.com"] })).toBe(true);
    expect(outboundNeedsGateway({ allowlist: "none", invocationId: "x" })).toBe(true);
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

describe("workerCodeId", () => {
  it("changes with code, env, flags and outbound blocking but not with the gateway instance", async () => {
    const base = {
      mainModule: "m.js",
      modules: { "m.js": "export default {}" },
      compatibilityDate: "2026-08-28",
    };
    const id = await workerCodeId(base);

    expect(await workerCodeId({ ...base, globalOutbound: undefined })).toBe(id);
    expect(await workerCodeId({ ...base, env: { A: "1" } })).not.toBe(id);
    expect(await workerCodeId({ ...base, globalOutbound: null })).not.toBe(id);
    expect(await workerCodeId({ ...base, compatibilityFlags: ["nodejs_compat"] })).not.toBe(id);
    expect(await workerCodeId({ ...base, modules: { "m.js": "export default 1" } })).not.toBe(id);
  });
});

describe("code mode source", () => {
  it("renders a frozen tools object and a model-facing signature list", () => {
    const tools = [
      {
        name: "web_search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        name: "list-issues",
        inputSchema: { type: "object", properties: { repo: { type: "string" } } },
      },
    ];
    const source = renderToolProxySource({ tools });

    expect(source).toContain('"web_search": (args) => __callTool__("web_search", args)');
    expect(source).toContain('"list-issues"');
    expect(describeToolsForModel(tools)).toBe(
      "tools.web_search({ query: string }): Promise<unknown>\n  Search the web\ntools.list-issues({ repo?: string }): Promise<unknown>",
    );
  });
});
