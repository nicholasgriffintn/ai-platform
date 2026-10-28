import {
  isTerminalProjectTaskStatus,
  type ProjectTask,
  type ProjectTaskFixUp,
  type ProjectTaskPullRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { parseGitHubPullRequestUrl } from "~/modules/project-tasks/domain/pull-request-link";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { sendFixUp } from "./fix-ups";
import { postEvent, type WorkCaller } from "./work";

const MAX_FAILING_CHECKS = 20;

export interface PullRequestCheckResult {
  repository: string;
  pullRequests: number[];
  headSha: string;
  conclusion: string | null;
  name: string | null;
  url: string | null;
}

export interface PullRequestReviewResult {
  repository: string;
  pullRequest: number;
  reviewer: string;
  body: string;
  url: string | null;
}

function systemCaller(task: ProjectTask, name: string): WorkCaller {
  const userId = task.runnerIdentityUserId ?? task.createdByUserId;

  return {
    actor: { type: "person", userId },
    author: { kind: "system", name, userId: null, teammateId: null },
  };
}

async function ownerContext(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ServiceContext | null> {
  const user = await context.repositories
    .get(UserRepository)
    .getUserById(task.runnerIdentityUserId ?? task.createdByUserId);

  return user ? createServiceContext({ env: context.env, user }) : null;
}

async function linkedTasks(
  context: ServiceContext,
  repository: string,
  number: number,
  installationOwnerId: number,
): Promise<ProjectTask[]> {
  const owner = await context.repositories.get(UserRepository).getUserById(installationOwnerId);

  if (!owner) {
    return [];
  }

  const ownerScope = createServiceContext({ env: context.env, user: owner });
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listOpenTasksForPullRequest(repository, number);
  const visible = await Promise.all(
    tasks.map((task) =>
      requireProjectAccess(ownerScope, task.projectId).then(
        () => task,
        () => null,
      ),
    ),
  );

  return visible.filter((task): task is ProjectTask => task !== null);
}

export async function linkTaskPullRequest(
  context: ServiceContext,
  task: ProjectTask,
  url: string,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const parsed = parseGitHubPullRequestUrl(url);

  if (!parsed) {
    throw new AssistantError(
      "Give the GitHub pull request's address, like https://github.com/owner/repo/pull/12.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (isTerminalProjectTaskStatus(task.status)) {
    throw new AssistantError("This task is already finished", ErrorType.CONFLICT_ERROR, 409);
  }

  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: {
      ...task.details,
      pullRequest: { repository: parsed.repository, number: parsed.number, url: parsed.url },
    },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(
    context,
    updated,
    caller,
    `${caller.author.name} linked ${parsed.repository}#${parsed.number}. CI results and reviews on it come back here.`,
  );

  return updated;
}

function nextChecks(
  current: ProjectTaskPullRequest["checks"],
  result: PullRequestCheckResult,
): NonNullable<ProjectTaskPullRequest["checks"]> {
  const base =
    current?.headSha === result.headSha
      ? current
      : { headSha: result.headSha, state: "pending" as const, failing: [] };
  const failed = isFailure(result.conclusion);
  const name = result.name ?? "Checks";
  const failing =
    failed && !base.failing.some((check) => check.name === name)
      ? [...base.failing, { name, url: result.url }].slice(0, MAX_FAILING_CHECKS)
      : base.failing;

  return {
    headSha: result.headSha,
    state: failing.length > 0 ? "failing" : result.conclusion === "success" ? "passing" : "pending",
    failing,
    updatedAt: new Date().toISOString(),
  };
}

function isFailure(conclusion: string | null): boolean {
  return conclusion === "failure" || conclusion === "timed_out" || conclusion === "action_required";
}

function describeFailures(checks: NonNullable<ProjectTaskPullRequest["checks"]>): string {
  return checks.failing
    .map((check) => (check.url ? `${check.name} (${check.url})` : check.name))
    .join(", ");
}

export async function recordPullRequestCheck(
  context: ServiceContext,
  result: PullRequestCheckResult,
  installationOwnerId: number,
): Promise<number> {
  let touched = 0;

  for (const number of result.pullRequests) {
    for (const task of await linkedTasks(context, result.repository, number, installationOwnerId)) {
      const pullRequest = task.details.pullRequest;
      const scoped = await ownerContext(context, task);

      if (!pullRequest || !scoped) {
        continue;
      }

      const checks = nextChecks(pullRequest.checks, result);
      const newlyFailing = checks.state === "failing" && pullRequest.checks?.state !== "failing";
      const newlyPassing = checks.state === "passing" && pullRequest.checks?.state !== "passing";
      const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
        details: { ...task.details, pullRequest: { ...pullRequest, checks } },
      });

      if (!updated) {
        continue;
      }

      touched += 1;

      if (newlyFailing) {
        await sendFixUp(
          scoped,
          updated,
          {
            source: "ci",
            from: "CI",
            note: `CI failed on ${result.repository}#${number} at ${result.headSha.slice(0, 7)}: ${describeFailures(checks)}. Read the failing logs, fix the cause on the same branch and push.`,
          },
          systemCaller(updated, "CI"),
        );
      } else if (newlyPassing) {
        await postEvent(
          scoped,
          updated,
          systemCaller(updated, "CI"),
          `CI passed on ${result.repository}#${number} at ${result.headSha.slice(0, 7)}.`,
        );
      }
    }
  }

  return touched;
}

export async function recordPullRequestReview(
  context: ServiceContext,
  review: PullRequestReviewResult,
  installationOwnerId: number,
): Promise<number> {
  let touched = 0;

  for (const task of await linkedTasks(
    context,
    review.repository,
    review.pullRequest,
    installationOwnerId,
  )) {
    const scoped = await ownerContext(context, task);

    if (!scoped) {
      continue;
    }

    await sendFixUp(scoped, task, reviewFixUp(review), systemCaller(task, review.reviewer));
    touched += 1;
  }

  return touched;
}

function reviewFixUp(review: PullRequestReviewResult): Omit<ProjectTaskFixUp, "at"> {
  const body = review.body.trim() || "Changes were requested without a written summary.";

  return {
    source: "pull_request_review",
    from: review.reviewer,
    note: `${body.slice(0, 7000)}${review.url ? `\n\nReview: ${review.url}` : ""}`,
  };
}
