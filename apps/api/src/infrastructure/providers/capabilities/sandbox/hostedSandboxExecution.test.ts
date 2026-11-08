import { describe, expect, it } from "vitest";

import { buildHostedSandboxRunResult } from "./hostedSandboxExecution";

describe("hosted sandbox results", () => {
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
});
