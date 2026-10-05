import type {
  ProjectTask,
  ProjectTaskCompletion,
  PullRequestReview,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createOutput } from "~/modules/outputs/application";
import {
  addOutputProvenanceSources,
  createExecutionOutputProvenance,
} from "~/modules/outputs/application/provenance";

export async function retainTaskReviewCompletion(
  context: ServiceContext,
  task: Readonly<ProjectTask>,
  completion: Readonly<ProjectTaskCompletion>,
): Promise<ProjectTaskCompletion | null> {
  const review = await context.repositories.projectTaskIntegrations.getReviewForTask(
    task.id,
    task.projectId,
  );

  if (!review) {
    return null;
  }

  const outputId = await retainReviewOutput(context, review, completion);

  return {
    ...completion,
    outputIds: [...new Set([...(completion.outputIds ?? []), outputId])],
  };
}

export async function retainReviewOutput(
  context: ServiceContext,
  review: PullRequestReview,
  completion: ProjectTaskCompletion,
): Promise<string> {
  const outputId = `pr_review_${review.id}_${completion.id}`;
  const existing = await context.repositories.outputs.getOutput(outputId);

  if (existing) {
    if (existing.project_id !== review.projectId || existing.group_id !== review.id) {
      throw new AssistantError("Review output belongs to another scope", ErrorType.FORBIDDEN, 403);
    }

    return outputId;
  }

  const provenance = addOutputProvenanceSources(
    await createExecutionOutputProvenance(context, {
      runId: completion.runId,
      capturedAt: completion.createdAt,
    }),
    [review.sourceId],
  );

  try {
    await createOutput(
      context,
      context.requireUser().id,
      {
        projectId: review.projectId,
        conversationId: completion.conversationId,
        capabilityId: "pull-request-review",
        groupId: review.id,
        kind: "code-review",
        title: `Review ${review.target.repository}#${review.target.pullRequestNumber}`.slice(
          0,
          200,
        ),
        status: "ready",
        sensitivity: "internal",
        content: {
          body: completion.output,
          target: review.target,
          sourceId: review.sourceId,
          completionId: completion.id,
        },
      },
      { id: outputId, provenance },
    );
  } catch (error) {
    const retained = await context.repositories.outputs.getOutput(outputId);

    if (!retained || retained.project_id !== review.projectId || retained.group_id !== review.id) {
      throw error;
    }
  }

  return outputId;
}
