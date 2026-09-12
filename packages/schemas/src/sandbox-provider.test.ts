import { describe, expect, it } from "vitest";

import { sandboxWorkerExecuteRequestSchema } from "./sandbox";
import { isSandboxPullRequestUrl, sandboxReviewBranchName } from "./sandbox-delivery";
import { resolveSandboxExecutionProvider, SANDBOX_EXECUTION_PROVIDERS } from "./sandbox-provider";

describe("sandbox provider contract", () => {
  it("requires credential brokering for every execution provider", () => {
    expect(SANDBOX_EXECUTION_PROVIDERS).not.toHaveLength(0);

    for (const provider of SANDBOX_EXECUTION_PROVIDERS) {
      expect(provider.capabilities.credentialBroker).toBe(true);
    }
  });

  it("defaults unknown providers to the managed sandbox", () => {
    expect(resolveSandboxExecutionProvider("unknown")).toBe("polychat");
  });

  it("carries environment variables resolved by the trusted API into worker requests", () => {
    const parsed = sandboxWorkerExecuteRequestSchema.parse({
      userId: 1,
      repo: "owner/repository",
      task: "Implement the feature",
      environmentVariables: { BUILD_MODE: "release" },
      credentialBroker: {
        baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/run-1",
        expiresAt: "2026-09-12T12:00:00.000Z",
        grant: "scoped-grant",
      },
      polychatApiUrl: "https://api.polychat.app",
      runId: "run-1",
    });

    expect(parsed.environmentVariables).toEqual({ BUILD_MODE: "release" });
  });

  it("uses one delivery branch and pull-request URL contract", () => {
    expect(sandboxReviewBranchName("run-123")).toBe("polychat/run-run-123");
    expect(
      isSandboxPullRequestUrl("owner/repository", "https://github.com/owner/repository/pull/123"),
    ).toBe(true);
    expect(
      isSandboxPullRequestUrl("owner/repository", "https://github.com/another/repository/pull/123"),
    ).toBe(false);
  });
});
