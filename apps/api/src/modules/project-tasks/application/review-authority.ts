import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getGitHubTaskConnection } from "~/modules/github/application/connections";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function assertReviewDispatchAuthority(
  context: ServiceContext,
  task: ProjectTask,
): Promise<void> {
  if (task.executionProfile !== "diff_review") {
    return;
  }

  const review = await context.repositories.projectTaskIntegrations.getReviewForTask(task.id);

  if (!review || review.projectId !== task.projectId) {
    throw new AssistantError("The review target is unavailable", ErrorType.NOT_FOUND, 404);
  }

  if (review.policyRevision !== "manual-v1") {
    await requireProjectAccess(context, task.projectId, ["owner", "admin"]);
    const policy = await context.repositories.projectTaskIntegrations.getPolicy(task.projectId);

    if (
      !policy?.enabled ||
      policy.revision !== review.policyRevision ||
      policy.ownerUserId !== context.requireUser().id ||
      policy.connectionId !== review.target.connectionId
    ) {
      throw new AssistantError(
        "Automatic review authority changed. Start a new manual review if needed.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  const bound = await getGitHubTaskConnection(
    context,
    context.requireUser().id,
    review.target.installationId,
    review.target.repository,
  );

  if (bound.connectionId !== review.target.connectionId) {
    throw new AssistantError(
      "The review's original connection is unavailable",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}
