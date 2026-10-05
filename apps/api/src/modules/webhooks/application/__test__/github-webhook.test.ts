import { createHmac } from "node:crypto";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  getGitHubAppConnectionForInstallation,
  getGitHubAppConnectionForUserInstallation,
} from "~/modules/github/application/connections";
import { enqueueProjectReviewIntake } from "~/modules/project-tasks/application/review-intake";
import {
  executeWebhookSandboxCommand,
  postWebhookSandboxResultComment,
} from "~/modules/webhooks/application/github-task-execution";

import { createIntegrationTestContext } from "../../../../../test/helpers/project-task-integrations";
import { handleGithubWebhook } from "../github-webhook";

vi.mock("~/modules/github/application/connections", () => ({
  getGitHubAppConnectionForInstallation: vi.fn(),
  getGitHubAppConnectionForUserInstallation: vi.fn(),
}));
vi.mock("~/modules/project-tasks/application/review-intake", () => ({
  enqueueProjectReviewIntake: vi.fn(),
}));
vi.mock("~/modules/webhooks/application/github-task-execution", () => ({
  executeWebhookSandboxCommand: vi.fn(),
  postWebhookSandboxResultComment: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>;
const event = {
  action: "synchronize",
  installation: { id: 10 },
  repository: { id: 20, full_name: "Owner/Repo" },
  pull_request: {
    number: 42,
    draft: false,
    state: "open",
    base: { sha: "a".repeat(40) },
    head: { sha: "b".repeat(40) },
  },
};
const secret = "test-webhook-secret";

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createIntegrationTestContext();
  vi.mocked(getGitHubAppConnectionForInstallation).mockResolvedValue({
    appId: "1",
    privateKey: "test-key",
    installationId: 10,
    webhookSecret: secret,
  });
});
afterEach(async () => {
  await fixture?.runtime.dispose();
});

it("rejects invalid signatures before admitting a PR revision", async () => {
  const result = await handleGithubWebhook({
    context: fixture.context,
    payload: JSON.stringify(event),
    eventType: "pull_request",
    signature: "sha256=invalid",
  });

  expect(result.status).toBe(401);
  expect(enqueueProjectReviewIntake).not.toHaveBeenCalled();
});

it("requires a configured webhook secret", async () => {
  vi.mocked(getGitHubAppConnectionForInstallation).mockResolvedValue({
    appId: "1",
    privateKey: "test-key",
    installationId: 10,
  });
  const result = await handleGithubWebhook({
    context: fixture.context,
    payload: JSON.stringify(event),
    eventType: "pull_request",
  });

  expect(result.status).toBe(503);
  expect(enqueueProjectReviewIntake).not.toHaveBeenCalled();
});

it("admits a signed ready PR using the repository ID and exact commit pair", async () => {
  const payload = JSON.stringify(event);
  const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const result = await handleGithubWebhook({
    context: fixture.context,
    payload,
    eventType: "pull_request",
    signature,
  });

  expect(result.status).toBe(200);
  expect(vi.mocked(enqueueProjectReviewIntake).mock.calls[0]?.[1]).toEqual({
    provider: "github",
    accountId: "10",
    repository: "owner/repo",
    repositoryId: "20",
    pullRequestNumber: 42,
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
  });
});

it("skips drafts and rejects malformed commit targets", async () => {
  for (const [pullRequest, status] of [
    [{ ...event.pull_request, draft: true }, 200],
    [{ ...event.pull_request, head: { sha: "main" } }, 400],
  ] as const) {
    const payload = JSON.stringify({ ...event, pull_request: pullRequest });
    const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

    expect(
      (
        await handleGithubWebhook({
          context: fixture.context,
          payload,
          eventType: "pull_request",
          signature,
        })
      ).status,
    ).toBe(status);
  }

  expect(enqueueProjectReviewIntake).not.toHaveBeenCalled();
});

it("uses the linked commenter's connection for execution and acknowledgement", async () => {
  await fixture.database
    .prepare(
      "INSERT INTO oauth_account (provider_id, provider_user_id, user_id) VALUES ('github', '101', 7)",
    )
    .run();
  const connection = {
    appId: "actor-app",
    privateKey: "actor-key",
    installationId: 10,
    webhookSecret: secret,
  };

  vi.mocked(getGitHubAppConnectionForUserInstallation).mockResolvedValue(connection);
  vi.mocked(executeWebhookSandboxCommand).mockResolvedValue({
    success: true,
    responseId: "actor-result",
  });
  vi.mocked(postWebhookSandboxResultComment).mockResolvedValue(undefined);
  const payload = JSON.stringify({
    action: "created",
    installation: { id: 10 },
    repository: { full_name: "owner/repo" },
    issue: { number: 42 },
    comment: { body: "/fix Preserve filters", user: { id: 101 } },
  });
  const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const result = await handleGithubWebhook({
    context: fixture.context,
    payload,
    eventType: "issue_comment",
    signature,
  });

  expect(result.body).toMatchObject({ response_id: "actor-result" });
  expect(executeWebhookSandboxCommand).toHaveBeenCalledWith(
    expect.objectContaining({
      user: expect.objectContaining({ id: 7 }),
      repo: "owner/repo",
    }),
  );
  expect(postWebhookSandboxResultComment).toHaveBeenCalledWith(
    expect.objectContaining({
      connection,
    }),
  );
  vi.mocked(getGitHubAppConnectionForUserInstallation).mockRejectedValueOnce(new Error("Revoked"));
  await handleGithubWebhook({
    context: fixture.context,
    payload,
    eventType: "issue_comment",
    signature,
  });
  expect(executeWebhookSandboxCommand).toHaveBeenCalledTimes(1);
  expect(postWebhookSandboxResultComment).toHaveBeenCalledTimes(1);
});
