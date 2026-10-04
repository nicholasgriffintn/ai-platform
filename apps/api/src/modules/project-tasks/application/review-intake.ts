import {
  GITHUB_PULL_REQUEST_INTAKE_TASK_TYPE,
  githubPullRequestIntakeSchema,
  type PullRequestReviewTarget,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/tasks/application/types";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

import { startProjectTask } from "./index";
import { reviewIdentity } from "./integration-identity";
import { createPullRequestReview } from "./pull-request-review";

export async function enqueueGithubReviewIntake(
  context: ServiceContext,
  target: Omit<PullRequestReviewTarget, "connectionId">,
): Promise<void> {
  const policies = await context.repositories.projectTaskIntegrations.listPolicies(
    target.installationId,
    target.repository,
  );
  const tasks = new TaskService(context.env, context.repositories.tasks);

  for (const policy of policies) {
    const boundTarget = { ...target, connectionId: policy.connectionId };
    const id = await reviewIdentity(policy.projectId, boundTarget, policy.revision);

    await tasks.enqueueTask({
      id: `pr_intake_${id}`,
      task_type: GITHUB_PULL_REQUEST_INTAKE_TASK_TYPE,
      user_id: policy.ownerUserId,
      project_id: policy.projectId,
      priority: 5,
      task_data: {
        projectId: policy.projectId,
        policyRevision: policy.revision,
        target: boundTarget,
      },
    });
  }
}

export class GithubReviewIntakeHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const data = githubPullRequestIntakeSchema.parse(message.task_data);
    const base = createServiceContext({ env });
    const user = message.user_id
      ? await base.repositories.users.getUserById(message.user_id)
      : null;

    if (!user || message.project_id !== data.projectId) {
      return { status: "skipped", message: "Review owner or project is unavailable" };
    }

    const context = createServiceContext({ env, user });
    const policy = await context.repositories.projectTaskIntegrations.getPolicy(data.projectId);

    if (
      !policy?.enabled ||
      policy.revision !== data.policyRevision ||
      policy.ownerUserId !== user.id ||
      policy.connectionId !== data.target.connectionId ||
      policy.repository !== data.target.repository ||
      policy.installationId !== data.target.installationId
    ) {
      return { status: "skipped", message: "Automatic review policy changed" };
    }

    try {
      await requireProjectAccess(context, data.projectId, ["owner", "admin"]);
      const { review } = await createPullRequestReview(context, data.projectId, data.target, {
        policyRevision: policy.revision,
        expectedTarget: data.target,
        tokenBudget: policy.tokenBudget,
      });
      const task = await context.repositories.projectTasks.getTaskById(review.taskId);

      if (
        task &&
        (task.status === "backlog" ||
          (task.status === "blocked" && task.blockedReason === "dispatch_failed"))
      ) {
        const currentPolicy = await context.repositories.projectTaskIntegrations.getPolicy(
          data.projectId,
        );

        if (!currentPolicy?.enabled || currentPolicy.revision !== policy.revision) {
          return { status: "skipped", message: "Automatic review was disabled before execution" };
        }

        await startProjectTask(context, data.projectId, task.id, {
          automaticReviewPolicyRevision: policy.revision,
        });
      }

      return {
        status: "success",
        message: "PR review admitted to the project task runner",
        data: { reviewId: review.id },
      };
    } catch (error) {
      if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
        return { status: "skipped", message: "Review authority is no longer available" };
      }

      if (
        error instanceof AssistantError &&
        error.statusCode === 409 &&
        error.message.includes("superseded")
      ) {
        return { status: "skipped", message: "A newer PR revision superseded this delivery" };
      }

      throw error;
    }
  }
}
