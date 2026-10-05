import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { githubApiRequest } from "~/infrastructure/github/api-client";
import { getGitHubTaskConnection } from "~/modules/github/application/connections";

import {
  completedReview,
  createGitHubReviewTestContext,
  locator,
  pr,
  comparison,
  queueCapture,
  target,
} from "../../../../../test/helpers/github-review";
import {
  createPullRequestReview,
  prepareReviewPublication,
  publishPullRequestReview,
  reconcileReviewPublication,
} from "../pull-request-review";

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: vi.fn() }));
vi.mock("~/infrastructure/github", () => ({ getGitHubAppInstallationToken: vi.fn() }));
vi.mock("~/modules/github/application/connections", () => ({ getGitHubTaskConnection: vi.fn() }));
vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createGitHubReviewTestContext>>;

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createGitHubReviewTestContext();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("pull request review admission", () => {
  it("reuses a review for repeated delivery and creates new work for a changed commit", async () => {
    vi.mocked(githubApiRequest).mockImplementation(async ({ url }) =>
      Response.json(url.includes("/compare/") ? comparison : pr),
    );
    const admitted = await Promise.all([
      createPullRequestReview(fixture.context, "project-1", locator),
      createPullRequestReview(fixture.context, "project-1", locator),
    ]);
    const first = admitted[0];

    expect(admitted[1].review.taskId).toBe(first.review.taskId);
    expect(admitted.filter((result) => result.reused)).toHaveLength(1);

    queueCapture();
    expect(await createPullRequestReview(fixture.context, "project-1", locator)).toMatchObject({
      reused: true,
      review: { taskId: first.review.taskId },
    });
    const next = { ...pr, head: { sha: "d".repeat(40) } };

    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(next))
      .mockResolvedValueOnce(Response.json(comparison))
      .mockResolvedValueOnce(Response.json(next));
    const changed = await createPullRequestReview(fixture.context, "project-1", locator);

    expect(changed.review.taskId).not.toBe(first.review.taskId);
    expect(
      await fixture.context.repositories.projectTasks.listProjectTasks("project-1"),
    ).toHaveLength(2);
  });
});

describe("human publication and uncertain outcomes", () => {
  it("prepares a governed output without posting, then publishes once with the reviewed commit", async () => {
    const { review, completion } = await completedReview(fixture);
    const prepared = await prepareReviewPublication(fixture.context, "project-1", review.id);

    expect(prepared.body).toBe(completion.output);
    expect(await fixture.context.repositories.outputs.getOutput(prepared.outputId)).toMatchObject({
      project_id: "project-1",
      kind: "code-review",
    });
    expect(
      vi.mocked(githubApiRequest).mock.calls.every(([request]) => request.method === "GET"),
    ).toBe(true);
    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(pr))
      .mockResolvedValueOnce(
        Response.json({ html_url: "https://github.com/owner/repo/pull/42#pullrequestreview-100" }),
      );
    await publishPullRequestReview(fixture.context, "project-1", review.id, {
      completionId: completion.id,
      body: "Human-approved review text",
    });
    await publishPullRequestReview(fixture.context, "project-1", review.id, {
      completionId: completion.id,
      body: "Human-approved review text",
    });
    const writes = vi
      .mocked(githubApiRequest)
      .mock.calls.filter(([request]) => request.method === "POST");

    expect(writes).toHaveLength(1);
    expect(writes[0][0].body).toMatchObject({
      commit_id: target.headSha,
      event: "COMMENT",
      body: expect.stringContaining("Human-approved review text"),
    });
  });

  it("refuses stale commits and a different credential owner", async () => {
    const { review, completion } = await completedReview(fixture);

    vi.mocked(githubApiRequest).mockResolvedValueOnce(
      Response.json({ ...pr, head: { sha: "d".repeat(40) } }),
    );
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Review",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    vi.mocked(getGitHubTaskConnection).mockResolvedValue({
      connectionId: "connection-2",
      connection: {
        appId: "1",
        privateKey: "test-key",
        installationId: 10,
        webhookSecret: "test-secret",
      },
    });
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Review",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(
      vi.mocked(githubApiRequest).mock.calls.filter(([request]) => request.method === "POST"),
    ).toHaveLength(0);
  });

  it("does not retry a timed-out publication and reconciles a matching GitHub review", async () => {
    const { review, completion } = await completedReview(fixture);

    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(pr))
      .mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Approved",
      }),
    ).rejects.toThrow("Response lost");
    expect(
      await fixture.context.repositories.projectTaskIntegrations.getReview(review.id),
    ).toMatchObject({ publicationStatus: "unknown" });
    vi.mocked(githubApiRequest).mockResolvedValueOnce(Response.json(pr));
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Approved",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const body = await fixture.context.repositories.projectTaskIntegrations.getPublicationBody(
      review.id,
    );

    vi.mocked(githubApiRequest).mockResolvedValueOnce(
      Response.json([
        {
          commit_id: target.headSha,
          body,
          state: "COMMENTED",
          html_url: "https://github.com/owner/repo/pull/42#pullrequestreview-100",
        },
      ]),
    );
    const reconciled = await reconcileReviewPublication(fixture.context, "project-1", review.id);

    expect(reconciled.review?.publicationStatus).toBe("published");
    expect(
      vi.mocked(githubApiRequest).mock.calls.filter(([request]) => request.method === "POST"),
    ).toHaveLength(1);
  });

  it.each(["cancelled", "replaced completion"] as const)(
    "refuses publication when the task is %s before the atomic claim",
    async (change) => {
      const { review, completion } = await completedReview(fixture);
      const repository = fixture.context.repositories.projectTaskIntegrations;
      const claimPublication = repository.claimPublication.bind(repository);

      vi.mocked(githubApiRequest).mockResolvedValueOnce(Response.json(pr));
      vi.spyOn(repository, "claimPublication").mockImplementationOnce(async (...args) => {
        await fixture.context.repositories.projectTasks.updateTask(
          review.taskId,
          change === "cancelled"
            ? { status: "cancelled" }
            : { completions: [completion, { ...completion, id: "completion-2" }] },
        );

        return claimPublication(...args);
      });
      await expect(
        publishPullRequestReview(fixture.context, "project-1", review.id, {
          completionId: completion.id,
          body: "Approved",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        vi.mocked(githubApiRequest).mock.calls.filter(([request]) => request.method === "POST"),
      ).toHaveLength(0);
      expect(await repository.getReview(review.id)).toMatchObject({
        publicationStatus: "unpublished",
      });
    },
  );
});
