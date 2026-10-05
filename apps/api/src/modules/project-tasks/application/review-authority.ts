import type { ProjectTask, PullRequestReview } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { connectTaskReview } from "../infrastructure/integrations";

export async function connectOwnedReview(context: ServiceContext, review: PullRequestReview) {
  if (review.ownerUserId !== context.requireUser().id) {
    throw new AssistantError(
      "Use the credential owner who created this review",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const client = await connectTaskReview(context, review.target);

  if (client.connectionId !== review.target.connectionId) {
    throw new AssistantError(
      "The review's original connection is unavailable",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return client;
}

export async function assertReviewDispatchAuthority(
  context: ServiceContext,
  task: ProjectTask,
): Promise<void> {
  if (task.executionProfile !== "diff_review") {
    return;
  }

  const review = await context.repositories.projectTaskIntegrations.getReviewForTask(
    task.id,
    task.projectId,
  );

  if (!review || review.workspaceId !== task.workspaceId) {
    throw new AssistantError("The review target is unavailable", ErrorType.NOT_FOUND, 404);
  }

  if (review.policyId) {
    await requireProjectAccess(context, task.projectId, ["owner", "admin"]);
    const policy = await context.repositories.projectTaskIntegrations.getPolicy(
      review.policyId,
      task.projectId,
    );

    if (
      !policy?.enabled ||
      policy.workspaceId !== review.workspaceId ||
      policy.revision !== review.policyRevision ||
      policy.ownerUserId !== context.requireUser().id ||
      policy.connectionId !== review.target.connectionId ||
      policy.provider !== review.target.provider ||
      policy.accountId !== review.target.accountId ||
      policy.repository !== review.target.repository
    ) {
      throw new AssistantError(
        "Automatic review authority changed. Start a new manual review if needed.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  await connectOwnedReview(context, review);
}
