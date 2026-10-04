import {
  gitCommitShaSchema,
  type PullRequestLocator,
  type PullRequestReviewTarget,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getGitHubAppInstallationToken } from "~/infrastructure/github";
import { githubApiRequest } from "~/infrastructure/github/api-client";
import { getGitHubTaskConnection } from "~/modules/github/application/connections";

const sha = gitCommitShaSchema;
const repositorySchema = z.object({ id: z.number().int().positive(), full_name: z.string() });
const pullRequest = z.object({
  number: z.number().int().positive(),
  title: z.string().max(1000),
  body: z.string().max(100000).nullable(),
  html_url: z.url(),
  state: z.enum(["open", "closed"]),
  draft: z.boolean(),
  changed_files: z.number().int().nonnegative(),
  base: z.object({ sha, repo: repositorySchema }),
  head: z.object({ sha }),
});

const changedFile = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  previous_filename: z.string().optional(),
  patch: z.string().optional(),
});

export class GitHubTaskClient {
  private constructor(
    private readonly token: string,
    readonly connectionId: string,
    readonly repository: string,
  ) {}

  static async forUser(
    context: ServiceContext,
    installationId: number,
    repositoryName: string,
  ): Promise<GitHubTaskClient> {
    const bound = await getGitHubTaskConnection(
      context,
      context.requireUser().id,
      installationId,
      repositoryName,
    );
    const token = await getGitHubAppInstallationToken(bound.connection);

    return new GitHubTaskClient(token, bound.connectionId, repositoryName);
  }

  private async get(path: string): Promise<unknown> {
    const response = await githubApiRequest({
      url: `https://api.github.com/repos/${this.repository}/${path}`,
      method: "GET",
      bearerToken: this.token,
    });

    return response.json();
  }

  async readIssue(issueNumber: number) {
    const issue = z
      .object({
        id: z.number().int().positive(),
        number: z.number().int().positive(),
        title: z.string().max(1000),
        body: z.string().max(100000).nullable(),
        html_url: z.url(),
        updated_at: z.string(),
        pull_request: z.unknown().optional(),
      })
      .parse(await this.get(`issues/${issueNumber}`));

    if (issue.pull_request !== undefined) {
      throw new AssistantError("Use PR review for a pull request", ErrorType.PARAMS_ERROR, 400);
    }

    return issue;
  }

  async readPullRequest(number: number) {
    const pr = pullRequest.parse(await this.get(`pulls/${number}`));

    if (pr.base.repo.full_name.toLowerCase() !== this.repository || pr.number !== number) {
      throw new AssistantError("Pull request repository does not match", ErrorType.FORBIDDEN, 403);
    }

    return pr;
  }

  async captureReview(locator: PullRequestLocator, expectedTarget?: PullRequestReviewTarget) {
    const before = await this.readPullRequest(locator.pullRequestNumber);

    if (before.state !== "open" || before.draft) {
      throw new AssistantError("Review an open, ready pull request", ErrorType.CONFLICT_ERROR, 409);
    }

    const target: PullRequestReviewTarget = {
      ...locator,
      connectionId: this.connectionId,
      repositoryId: before.base.repo.id,
      baseSha: before.base.sha,
      headSha: before.head.sha,
    };

    if (
      expectedTarget &&
      (expectedTarget.connectionId !== target.connectionId ||
        expectedTarget.repositoryId !== target.repositoryId ||
        expectedTarget.baseSha !== target.baseSha ||
        expectedTarget.headSha !== target.headSha)
    ) {
      throw new AssistantError(
        "This PR revision has been superseded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const comparison = z
      .object({ merge_base_commit: z.object({ sha }), files: z.array(changedFile).max(300) })
      .parse(await this.get(`compare/${target.baseSha}...${target.headSha}`));
    const after = await this.readPullRequest(locator.pullRequestNumber);

    if (
      after.base.sha !== target.baseSha ||
      after.head.sha !== target.headSha ||
      after.state !== "open" ||
      after.draft
    ) {
      throw new AssistantError(
        "The PR changed while its diff was captured. Try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    let remaining = 100000;
    const omitted: string[] = [];
    const diffs: string[] = [];

    for (const file of comparison.files) {
      if (!file.patch || file.patch.length > remaining) {
        omitted.push(file.filename);
        continue;
      }

      remaining -= file.patch.length;
      diffs.push(
        `File: ${file.filename}\nStatus: ${file.status}\n${file.previous_filename ? `Previous path: ${file.previous_filename}\n` : ""}${file.patch}`,
      );
    }

    const unavailableCount = Math.max(0, before.changed_files - comparison.files.length);
    const content = [
      `PR: ${before.html_url}`,
      `Title: ${before.title}`,
      `Base: ${target.baseSha}`,
      `Head: ${target.headSha}`,
      `Merge base: ${comparison.merge_base_commit.sha}`,
      `Changed files: ${before.changed_files}`,
      "Coverage is limited to patch text supplied by GitHub. Repository context and runtime behaviour were not verified.",
      `Omitted patches (binary, unavailable or context limit): ${omitted.join(", ") || "none"}`,
      `Additional files beyond GitHub's comparison limit: ${unavailableCount}`,
      `Description:\n${(before.body ?? "").slice(0, 10000)}`,
      ...diffs,
    ].join("\n\n");

    return {
      target,
      title: before.title,
      url: before.html_url,
      content,
      omitted,
      unavailableCount,
    };
  }

  async publishReview(target: PullRequestReviewTarget, body: string): Promise<string> {
    const response = await githubApiRequest({
      url: `https://api.github.com/repos/${this.repository}/pulls/${target.pullRequestNumber}/reviews`,
      method: "POST",
      bearerToken: this.token,
      body: { commit_id: target.headSha, event: "COMMENT", body },
    });

    return z.object({ html_url: z.url() }).parse(await response.json()).html_url;
  }

  async findPublication(
    target: PullRequestReviewTarget,
    expectedBody: string,
  ): Promise<string | null> {
    const published = z.array(
      z.object({
        body: z.string().nullable(),
        commit_id: z.string(),
        html_url: z.url(),
        state: z.string(),
      }),
    );

    for (let page = 1; page <= 10; page++) {
      const reviews = published.parse(
        await this.get(`pulls/${target.pullRequestNumber}/reviews?per_page=100&page=${page}`),
      );
      const match = reviews.find(
        (review) =>
          review.commit_id === target.headSha &&
          review.body === expectedBody &&
          review.state === "COMMENTED",
      );

      if (match) {
        return match.html_url;
      }

      if (reviews.length < 100) {
        return null;
      }
    }

    return null;
  }
}
