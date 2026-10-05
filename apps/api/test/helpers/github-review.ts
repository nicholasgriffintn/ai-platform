import type { ProjectTaskCompletion, PullRequestReviewTarget } from "@ngriffin_uk/polychat-schemas";
import { vi } from "vitest";

import { getGitHubAppInstallationToken } from "~/infrastructure/github";
import { githubApiRequest } from "~/infrastructure/github/api-client";
import { getGitHubTaskConnection } from "~/modules/github/application/connections";
import { createPullRequestReview } from "~/modules/project-tasks/application/pull-request-review";

import { createIntegrationTestContext } from "./project-task-integrations";

export const locator = { installationId: 10, repository: "owner/repo", pullRequestNumber: 42 };
export const target: PullRequestReviewTarget = {
  ...locator,
  connectionId: "connection-1",
  repositoryId: 20,
  baseSha: "a".repeat(40),
  headSha: "b".repeat(40),
};
export const pr = {
  number: 42,
  title: "Preserve filters",
  body: "Fix refresh",
  html_url: "https://github.com/owner/repo/pull/42",
  state: "open",
  draft: false,
  changed_files: 2,
  base: { sha: target.baseSha, repo: { id: 20, full_name: "owner/repo" } },
  head: { sha: target.headSha },
};
export const comparison = {
  merge_base_commit: { sha: "c".repeat(40) },
  files: [
    {
      filename: "src/filters.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      patch: "@@ -1 +1 @@\n-old\n+new",
    },
    { filename: "asset.png", status: "added", additions: 0, deletions: 0 },
  ],
};

export async function createGitHubReviewTestContext() {
  const fixture = await createIntegrationTestContext();

  await fixture.database
    .prepare(
      "INSERT INTO provider_connection (id, user_id, provider, kind, external_id, encrypted_data) VALUES ('connection-1', 7, 'github', 'github_app', '10', '{}')",
    )
    .run();
  vi.mocked(getGitHubTaskConnection).mockResolvedValue({
    connectionId: "connection-1",
    connection: {
      appId: "1",
      privateKey: "test-key",
      installationId: 10,
      webhookSecret: "test-secret",
    },
  });
  vi.mocked(getGitHubAppInstallationToken).mockResolvedValue("test-token");

  return fixture;
}

export function queueCapture() {
  vi.mocked(githubApiRequest)
    .mockResolvedValueOnce(Response.json(pr))
    .mockResolvedValueOnce(Response.json(comparison))
    .mockResolvedValueOnce(Response.json(pr));
}

export async function completedReview(
  fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>,
) {
  queueCapture();
  const { review } = await createPullRequestReview(fixture.context, "project-1", locator);
  const conversationId = "review-conversation";

  await fixture.database
    .prepare("INSERT INTO conversation (id, user_id, project_id) VALUES (?, 7, 'project-1')")
    .bind(conversationId)
    .run();
  const completion: ProjectTaskCompletion = {
    id: "completion-1",
    stageId: "review",
    conversationId,
    goalId: "goal-1",
    output: "One actionable finding in src/filters.ts:1. The binary asset was not reviewed.",
    evidence: [],
    approval: { mode: "human", status: "pending", reviewedByUserId: null, reviewedAt: null },
    createdAt: "2026-10-04T00:00:00Z",
  };

  await fixture.context.repositories.projectTasks.updateTask(review.taskId, {
    status: "review",
    completions: [completion],
  });

  return { review, completion };
}
