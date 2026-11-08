import { describe, expect, it } from "vitest";

import {
  createSandboxCredentialBrokerAccess,
  verifySandboxCredentialBrokerGrant,
} from "./credential-broker-grants";

const env = { JWT_SECRET: "sandbox-broker-test-secret-with-enough-entropy" };

describe("sandbox credential broker grants", () => {
  it("does not grant writes for an uncommitted run", async () => {
    const access = await createSandboxCredentialBrokerAccess({
      env,
      apiBaseUrl: "https://api.polychat.app",
      deliveryPolicy: { mode: "leave_uncommitted" },
      installationId: 42,
      repo: "owner/repository",
      runId: "run-456",
      timeoutSeconds: 900,
      userId: 7,
    });
    const claims = await verifySandboxCredentialBrokerGrant({
      env,
      grant: access.grant,
      runId: "run-456",
    });

    expect(claims.operations).toEqual(["repository_read"]);
    expect(claims.write_refs).toEqual([]);
  });

  it("stages direct delivery without granting access to the target ref", async () => {
    const access = await createSandboxCredentialBrokerAccess({
      env,
      apiBaseUrl: "https://api.polychat.app",
      deliveryPolicy: { mode: "commit_to_branch", targetBranch: "integration" },
      installationId: 42,
      repo: "owner/repository",
      runId: "run-456",
      timeoutSeconds: 900,
      userId: 7,
    });
    const claims = await verifySandboxCredentialBrokerGrant({
      env,
      grant: access.grant,
      runId: "run-456",
    });

    expect(claims.write_refs).toEqual(["refs/heads/polychat/run-run-456"]);
    expect(claims.delivery_target_ref).toBe("refs/heads/integration");
  });

  it("rejects reuse for another run", async () => {
    const access = await createSandboxCredentialBrokerAccess({
      env,
      apiBaseUrl: "https://api.polychat.app",
      deliveryPolicy: { mode: "leave_uncommitted" },
      installationId: 42,
      repo: "owner/repository",
      runId: "run-789",
      timeoutSeconds: 900,
      userId: 7,
    });

    await expect(
      verifySandboxCredentialBrokerGrant({
        env,
        grant: access.grant,
        runId: "another-run",
      }),
    ).rejects.toThrow("does not match this run");
  });
});
