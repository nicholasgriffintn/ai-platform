import { afterEach, describe, expect, it, vi } from "vitest";

import { buildHostedSandboxRunResult, verifyHostedSandboxDelivery } from "./hostedSandboxExecution";

describe("hosted sandbox results", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalises hosted artifacts into the existing Work run result", () => {
    const result = buildHostedSandboxRunResult({
      repo: "owner/repository",
      runId: "openai-run-123",
      resultArtifact: JSON.stringify({
        summary: "Implemented the feature",
        changedFiles: ["src/index.ts"],
        validation: [{ command: "pnpm test", status: "passed", exitCode: 0 }],
        residualRisks: [],
        incompleteWork: [],
        branchName: "polychat/run-openai-run-123",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        pullRequestUrl: "https://github.com/owner/repository/pull/1",
      }),
      diffArtifact: "diff --git a/src/index.ts b/src/index.ts",
      outputText: "Finished",
      deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
    });

    expect(result).toMatchObject({
      success: true,
      summary: "Implemented the feature",
      branchName: "polychat/run-openai-run-123",
      pullRequestUrl: "https://github.com/owner/repository/pull/1",
      proof: {
        changedFiles: ["src/index.ts"],
        validation: { qualityGate: "passed" },
        delivery: { commit: "0123456789abcdef0123456789abcdef01234567" },
      },
    });
  });

  it("fails a completed hosted turn without trustworthy result evidence", () => {
    const result = buildHostedSandboxRunResult({
      repo: "owner/repository",
      runId: "openai-run-123",
      outputText: "The turn completed without artifacts",
      deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
    });

    expect(result.success).toBe(false);
    expect(result.proof?.incompleteWork).toContain(
      "The hosted sandbox did not publish a valid structured result.",
    );
  });

  it("rejects delivery evidence for another repository", () => {
    const result = buildHostedSandboxRunResult({
      repo: "owner/repository",
      runId: "openai-run-123",
      resultArtifact: JSON.stringify({
        summary: "Implemented the feature",
        changedFiles: [],
        validation: [{ command: "pnpm test", status: "passed" }],
        residualRisks: [],
        incompleteWork: [],
        branchName: "polychat/run-openai-run-123",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        pullRequestUrl: "https://github.com/attacker/repository/pull/1",
      }),
      outputText: "Finished",
      deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
    });

    expect(result.success).toBe(false);
    expect(result.pullRequestUrl).toBeUndefined();
  });

  it("verifies delivery evidence through the credential broker", async () => {
    const result = buildHostedSandboxRunResult({
      repo: "owner/repository",
      runId: "openai-run-123",
      resultArtifact: JSON.stringify({
        summary: "Implemented the feature",
        changedFiles: ["src/index.ts"],
        validation: [{ command: "pnpm test", status: "passed" }],
        residualRisks: [],
        incompleteWork: [],
        branchName: "polychat/run-openai-run-123",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        pullRequestUrl: "https://github.com/owner/repository/pull/1",
      }),
      outputText: "Finished",
      deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ commit: { sha: "0123456789abcdef0123456789abcdef01234567" } }),
      )
      .mockResolvedValueOnce(Response.json({ default_branch: "main" }))
      .mockResolvedValueOnce(
        Response.json([{ html_url: "https://github.com/owner/repository/pull/1" }]),
      );

    vi.stubGlobal("fetch", fetch);

    await expect(
      verifyHostedSandboxDelivery({
        result,
        repo: "owner/repository",
        runId: "openai-run-123",
        deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
        credentialBroker: {
          baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/openai-run-123",
          expiresAt: "2026-09-12T12:00:00.000Z",
          grant: "scoped-broker-grant",
        },
      }),
    ).resolves.toMatchObject({ success: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
