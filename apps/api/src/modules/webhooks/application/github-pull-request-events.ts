import { sandboxRepoSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type {
  PullRequestCheckResult,
  PullRequestReviewResult,
} from "~/modules/project-tasks/application/pull-request-feedback";

export const GITHUB_CHECK_EVENTS = ["check_run", "check_suite", "workflow_run"] as const;
export type GitHubCheckEvent = (typeof GITHUB_CHECK_EVENTS)[number];

const repositorySchema = z.object({
  full_name: sandboxRepoSchema.transform((value) => value.toLowerCase()),
});
const pullRequestsSchema = z.array(z.object({ number: z.number().int().positive() })).max(50);

const checkRunEventSchema = z.object({
  action: z.literal("completed"),
  repository: repositorySchema,
  check_run: z.object({
    name: z.string().min(1).max(200),
    head_sha: z.string().min(7),
    conclusion: z.string().nullable(),
    html_url: z.url().nullable().optional(),
    pull_requests: pullRequestsSchema,
  }),
});

const checkSuiteEventSchema = z.object({
  action: z.literal("completed"),
  repository: repositorySchema,
  check_suite: z.object({
    head_sha: z.string().min(7),
    conclusion: z.string().nullable(),
    pull_requests: pullRequestsSchema,
  }),
});

const workflowRunEventSchema = z.object({
  action: z.literal("completed"),
  repository: repositorySchema,
  workflow_run: z.object({
    name: z.string().min(1).max(200),
    head_sha: z.string().min(7),
    conclusion: z.string().nullable(),
    html_url: z.url().nullable().optional(),
    pull_requests: pullRequestsSchema,
  }),
});

const reviewEventSchema = z.object({
  action: z.literal("submitted"),
  repository: repositorySchema,
  pull_request: z.object({ number: z.number().int().positive() }),
  review: z.object({
    state: z.string(),
    body: z.string().nullable(),
    html_url: z.url().nullable().optional(),
    user: z.object({ login: z.string().min(1) }).nullable(),
  }),
});

export function isGitHubCheckEvent(eventType: string | undefined): eventType is GitHubCheckEvent {
  return GITHUB_CHECK_EVENTS.some((event) => event === eventType);
}

export function readGitHubCheckResult(
  eventType: GitHubCheckEvent,
  raw: unknown,
): PullRequestCheckResult | null {
  if (eventType === "check_suite") {
    const event = checkSuiteEventSchema.safeParse(raw);

    return event.success
      ? {
          repository: event.data.repository.full_name,
          pullRequests: event.data.check_suite.pull_requests.map((pull) => pull.number),
          headSha: event.data.check_suite.head_sha,
          conclusion: event.data.check_suite.conclusion,
          name: null,
          url: null,
        }
      : null;
  }

  const event =
    eventType === "check_run"
      ? checkRunEventSchema.safeParse(raw)
      : workflowRunEventSchema.safeParse(raw);

  if (!event.success) {
    return null;
  }

  const run = "check_run" in event.data ? event.data.check_run : event.data.workflow_run;

  return {
    repository: event.data.repository.full_name,
    pullRequests: run.pull_requests.map((pull) => pull.number),
    headSha: run.head_sha,
    conclusion: run.conclusion,
    name: run.name,
    url: run.html_url ?? null,
  };
}

export function readGitHubChangesRequested(raw: unknown): PullRequestReviewResult | null {
  const event = reviewEventSchema.safeParse(raw);

  return event.success && event.data.review.state.toLowerCase() === "changes_requested"
    ? {
        repository: event.data.repository.full_name,
        pullRequest: event.data.pull_request.number,
        reviewer: event.data.review.user ? `@${event.data.review.user.login}` : "A reviewer",
        body: event.data.review.body ?? "",
        url: event.data.review.html_url ?? null,
      }
    : null;
}
