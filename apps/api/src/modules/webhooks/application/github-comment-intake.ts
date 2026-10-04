import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { sandboxRepoSchema } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { extractSandboxCommand } from "~/infrastructure/github";
import type { GitHubAppConnection } from "~/modules/github/application/connection-parser";
import { getGitHubAppConnectionForUserInstallation } from "~/modules/github/application/connections";
import { startPullRequestReview } from "~/modules/project-tasks/application/pull-request-review";

import {
  executeWebhookSandboxCommand,
  postWebhookSandboxResultComment,
  type SandboxExecutionResult,
} from "./github-task-execution";

const logger = getLogger({ prefix: "webhooks/github-comment-intake" });
const eventSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number().int().positive() }),
  repository: z.object({ full_name: sandboxRepoSchema }),
  issue: z.object({ number: z.number().int().positive(), pull_request: z.object({}).optional() }),
  comment: z.object({ body: z.string(), user: z.object({ id: z.number().int().positive() }) }),
});

export async function processGithubComment(
  context: ServiceContext,
  raw: unknown,
  connection: GitHubAppConnection,
) {
  const event = eventSchema.safeParse(raw);

  if (!event.success || event.data.action !== "created") {
    return { success: true };
  }

  const data = event.data;
  const parsed = extractSandboxCommand(data.comment.body);

  if (!parsed) {
    return { success: true };
  }

  const user = await context.repositories.users.getUserByGithubId(String(data.comment.user.id));

  if (!user) {
    return { success: true };
  }

  try {
    await getGitHubAppConnectionForUserInstallation(
      context,
      user.id,
      data.installation.id,
      data.repository.full_name,
    );
  } catch {
    return { success: true };
  }

  const actorContext = createServiceContext({ env: context.env, user });
  let result: SandboxExecutionResult;

  if (parsed.command === "review" && data.issue.pull_request) {
    const policies = (
      await actorContext.repositories.projectTaskIntegrations.listPolicies(
        data.installation.id,
        data.repository.full_name.toLowerCase(),
      )
    ).filter((policy) => policy.ownerUserId === user.id);

    if (policies.length !== 1) {
      result = {
        success: false,
        error:
          "Select the project in Work → Tasks → PR reviews to review this pull request. A comment command needs exactly one enabled review policy owned by your account for this repository.",
      };
    } else {
      try {
        const { review } = await startPullRequestReview(actorContext, policies[0].projectId, {
          installationId: data.installation.id,
          repository: data.repository.full_name.toLowerCase(),
          pullRequestNumber: data.issue.number,
        });

        result = {
          success: true,
          summary: `Commit-bound review started in Work task ${review.taskId}. Approve publication from Work when the review finishes.`,
          responseId: review.taskId,
        };
      } catch (error) {
        result = {
          success: false,
          error: getErrorMessage(error, "Unable to start this PR review"),
        };
      }
    }
  } else {
    result = await executeWebhookSandboxCommand({
      command: parsed.command,
      repo: data.repository.full_name,
      task: parsed.task,
      installationId: data.installation.id,
      env: context.env,
      context: actorContext,
      user,
    });
  }

  try {
    await postWebhookSandboxResultComment({
      command: parsed.command,
      repo: data.repository.full_name,
      issueNumber: data.issue.number,
      result,
      connection,
      body:
        parsed.command === "review" && data.issue.pull_request
          ? `## PR review ${result.success ? "task" : "not started"}\n\n${result.summary ?? result.error}`
          : undefined,
    });
  } catch (error) {
    logger.error("Failed to post GitHub command result", {
      command: parsed.command,
      error_message: getErrorMessage(error),
    });
  }

  return { success: true, response_id: result.responseId };
}
