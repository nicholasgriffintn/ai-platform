import { afterEach, describe, expect, it, vi } from "vitest";

import { proxySandboxBranchDelivery } from "./credential-broker";
import { createSandboxCredentialBrokerAccess } from "./credential-broker-grants";

vi.mock("./github-credentials", () => ({
  resolveSandboxGitHubToken: vi.fn(async () => "github-installation-token"),
}));
vi.mock("./run-coordinator", () => ({
  getRunCoordinatorControl: vi.fn(async () => ({ state: "running" })),
}));

const env = { JWT_SECRET: "sandbox-broker-test-secret-with-enough-entropy" };

async function directDeliveryRequest() {
  const access = await createSandboxCredentialBrokerAccess({
    env,
    apiBaseUrl: "https://api.polychat.app",
    deliveryPolicy: { mode: "commit_to_branch", targetBranch: "integration" },
    installationId: 42,
    repo: "owner/repository",
    runId: "run-123",
    timeoutSeconds: 900,
    userId: 7,
  });

  return {
    access,
    context: {
      env,
      repositories: {
        activities: {
          getActivityByGroup: vi.fn(async () => ({
            created_by_user_id: 7,
            data: JSON.stringify({
              runId: "run-123",
              installationId: 42,
              repo: "owner/repository",
              task: "Implement the change",
              model: "gpt-6-astra",
              status: "running",
              startedAt: "2026-09-12T12:00:00.000Z",
              updatedAt: "2026-09-12T12:00:00.000Z",
            }),
          })),
        },
      },
    } as any,
  };
}

describe("sandbox credential broker delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("advances a direct target through a non-force broker update", async () => {
    const { access, context } = await directDeliveryRequest();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ object: { sha: "0123456789abcdef" } }))
      .mockResolvedValueOnce(Response.json({ ref: "refs/heads/integration" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetch);

    const response = await proxySandboxBranchDelivery({
      context,
      request: new Request(`${access.baseUrl}/github/deliveries`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access.grant}` },
      }),
      route: { runId: "run-123" },
      body: { head: "polychat/run-run-123", target: "integration" },
    });

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/owner/repository/git/refs/heads/integration",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sha: "0123456789abcdef", force: false }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.github.com/repos/owner/repository/git/refs/heads/polychat%2Frun-run-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("rejects a delivery target outside the grant", async () => {
    const { access, context } = await directDeliveryRequest();
    const fetch = vi.fn();

    vi.stubGlobal("fetch", fetch);

    await expect(
      proxySandboxBranchDelivery({
        context,
        request: new Request(`${access.baseUrl}/github/deliveries`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access.grant}` },
        }),
        route: { runId: "run-123" },
        body: { head: "polychat/run-run-123", target: "another-branch" },
      }),
    ).rejects.toThrow("does not allow this branch delivery");
    expect(fetch).not.toHaveBeenCalled();
  });
});
