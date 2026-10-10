import { describe, expect, it, vi } from "vitest";

import type { Env } from "../../../../types";
import { brokeredGitOutbound, buildSandboxEgressPolicy } from "../network-egress";

const PATH_PREFIX = "/apps/sandbox/credential-broker/run-1/git/";

function createEnv() {
  const apiFetch = vi.fn(async (_request: Request) => new Response("ok"));
  const recordBlockedEgress = vi.fn(async (_host: string) => undefined);
  const env = {
    POLYCHAT_API: { fetch: apiFetch },
    Sandbox: {
      idFromString: (id: string) => id,
      get: () => ({ recordBlockedEgress }),
    },
  } as unknown as Env;

  return { env, apiFetch, recordBlockedEgress };
}

describe("brokeredGitOutbound", () => {
  const ctx = { containerId: "container-1", params: { grant: "grant-1", pathPrefix: PATH_PREFIX } };

  it("adds the run grant to git traffic and drops credentials the container sent", async () => {
    const { env, apiFetch } = createEnv();

    await brokeredGitOutbound(
      new Request(`https://api.polychat.app${PATH_PREFIX}info/refs?service=git-upload-pack`, {
        headers: {
          Authorization: "Bearer stolen",
          Cookie: "session=1",
          "Git-Protocol": "version=2",
        },
      }),
      env,
      ctx,
    );

    const forwarded = apiFetch.mock.calls[0]?.[0];

    expect(new URL(forwarded?.url ?? "").pathname).toBe(`${PATH_PREFIX}info/refs`);
    expect(forwarded?.headers.get("Authorization")).toBe("Bearer grant-1");
    expect(forwarded?.headers.get("Cookie")).toBeNull();
    expect(forwarded?.headers.get("Git-Protocol")).toBe("version=2");
  });

  it("refuses broker paths outside the run's git endpoint", async () => {
    const { env, apiFetch, recordBlockedEgress } = createEnv();

    const response = await brokeredGitOutbound(
      new Request("https://api.polychat.app/apps/sandbox/credential-broker/run-2/git/info/refs"),
      env,
      ctx,
    );

    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(recordBlockedEgress).toHaveBeenCalledWith("api.polychat.app");
  });
});

describe("buildSandboxEgressPolicy", () => {
  it("keeps registries read-only and admits only declared and storage hosts", () => {
    const { env } = createEnv();
    const policy = buildSandboxEgressPolicy({
      env: { ...env, CLOUDFLARE_ACCOUNT_ID: "acct" },
      trustLevel: "balanced",
      declaredHosts: ["api.example.com"],
      directGitHubCheckout: false,
    });

    expect(policy.mode).toBe("list");
    expect(policy.hosts).toEqual(["acct.r2.cloudflarestorage.com", "api.example.com"]);
    expect(policy.readOnlyHosts).toContain("registry.npmjs.org");
    expect(policy.readOnlyHosts).not.toContain("github.com");
  });
});
