import { describe, expect, it, vi } from "vitest";

import { forwardBrokeredGit, isBrokeredGitRequest } from "../brokered-git";
import { buildSandboxEgressPolicy } from "../network-egress";

const PATH_PREFIX = "/apps/sandbox/credential-broker/run-1/git/";
const broker = { host: "api.polychat.app", pathPrefix: PATH_PREFIX, grant: "grant-1" };

describe("brokered git", () => {
  it("adds the run grant to git traffic and drops credentials the container sent", async () => {
    const apiFetch = vi.fn(async (_request: Request) => new Response("ok"));

    await forwardBrokeredGit(
      new Request(`https://api.polychat.app${PATH_PREFIX}info/refs?service=git-upload-pack`, {
        headers: {
          Authorization: "Bearer stolen",
          Cookie: "session=1",
          "Git-Protocol": "version=2",
        },
      }),
      broker,
      { fetch: apiFetch },
    );

    const forwarded = apiFetch.mock.calls[0]?.[0];

    expect(new URL(forwarded?.url ?? "").pathname).toBe(`${PATH_PREFIX}info/refs`);
    expect(forwarded?.headers.get("Authorization")).toBe("Bearer grant-1");
    expect(forwarded?.headers.get("Cookie")).toBeNull();
    expect(forwarded?.headers.get("Git-Protocol")).toBe("version=2");
  });

  it("refuses broker paths outside the run's git endpoint", () => {
    expect(
      isBrokeredGitRequest(
        new Request("https://api.polychat.app/apps/sandbox/credential-broker/run-2/git/info/refs"),
        broker,
      ),
    ).toBe(false);
  });
});

describe("buildSandboxEgressPolicy", () => {
  it("keeps registries read-only and admits only declared hosts", () => {
    const policy = buildSandboxEgressPolicy({
      trustLevel: "balanced",
      declaredHosts: ["api.example.com"],
      directGitHubCheckout: false,
    });

    expect(policy.mode).toBe("list");
    expect(policy.hosts).toEqual(["api.example.com"]);
    expect(policy.readOnlyHosts).toContain("registry.npmjs.org");
    expect(policy.readOnlyHosts).not.toContain("github.com");
  });
});
