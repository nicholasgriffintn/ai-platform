import {
  PROJECT_REVIEW_INTAKE_TASK_TYPE,
  projectReviewIntakeSchema,
  type PullRequestReviewTarget,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/tasks/application/types";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

import { reviewIdentity } from "./integration-identity";
import { startPullRequestReview } from "./pull-request-review";
import { matchesReviewPolicy } from "./review-policy";

export async function enqueueProjectReviewIntake(
  context: ServiceContext,
  target: Omit<PullRequestReviewTarget, "connectionId">,
): Promise<void> {
  const policies = await context.repositories.projectTaskIntegrations.listPolicies(
    target.provider,
    target.accountId,
    target.repository,
  );
  const tasks = new TaskService(context.env, context.repositories.tasks);

  for (const policy of policies) {
    const boundTarget = { ...target, connectionId: policy.connectionId };
    const id = await reviewIdentity(policy.projectId, boundTarget, policy.revision);

    await tasks.enqueueTask({
      id: `pr_intake_${id}`,
      task_type: PROJECT_REVIEW_INTAKE_TASK_TYPE,
      user_id: policy.ownerUserId,
      project_id: policy.projectId,
      priority: 5,
      task_data: {
        workspaceId: policy.workspaceId,
        policyId: policy.id,
        projectId: policy.projectId,
        policyRevision: policy.revision,
        target: boundTarget,
      },
    });
  }
}

export class ProjectReviewIntakeHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const data = projectReviewIntakeSchema.parse(message.task_data);
    const base = createServiceContext({ env });
    const user = message.user_id
      ? await base.repositories.users.getUserById(message.user_id)
      : null;

    if (!user || message.project_id !== data.projectId) {
      return { status: "skipped", message: "Review owner or project is unavailable" };
    }

    const context = createServiceContext({ env, user });
    const policy = await context.repositories.projectTaskIntegrations.getPolicy(
      data.policyId,
      data.projectId,
    );

    if (!policy || !matchesReviewPolicy(policy, { ...data, ownerUserId: user.id })) {
      return { status: "skipped", message: "Automatic review policy changed" };
    }

    try {
      const { project } = await requireProjectAccess(context, data.projectId, ["owner", "admin"]);

      if (project.workspace_id !== data.workspaceId) {
        return { status: "skipped", message: "Review workspace changed" };
      }

      const { review } = await startPullRequestReview(context, data.projectId, data.target, {
        policy,
        expectedTarget: data.target,
      });

      return {
        status: "success",
        message: "PR review admitted to the project task runner",
        data: { reviewId: review.id },
      };
    } catch (error) {
      if (
        error instanceof AssistantError &&
        error.statusCode === 409 &&
        error.context?.reason === "review_policy_changed"
      ) {
        return { status: "skipped", message: "Automatic review was disabled before execution" };
      }

      if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
        return { status: "skipped", message: "Review authority is no longer available" };
      }

      if (
        error instanceof AssistantError &&
        error.statusCode === 409 &&
        ["review_superseded", "review_target_unavailable"].includes(String(error.context?.reason))
      ) {
        return { status: "skipped", message: "This PR revision is no longer available for review" };
      }

      throw error;
    }
  }
}
