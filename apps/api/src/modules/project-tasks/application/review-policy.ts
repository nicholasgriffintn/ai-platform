import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  reviewPolicyInputSchema,
  reviewPolicySchema,
  type ProjectTask,
  type PullRequestReview,
  type ReviewPolicy,
  type ReviewPolicyInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { connectTaskReview } from "../infrastructure/integrations";
import { reviewPolicyIdentity } from "./integration-identity";

export function matchesReviewPolicy(
  policy: ReviewPolicy,
  review: Pick<
    PullRequestReview,
    "workspaceId" | "projectId" | "ownerUserId" | "target" | "policyRevision"
  >,
): boolean {
  return (
    policy.enabled &&
    policy.revision === review.policyRevision &&
    policy.workspaceId === review.workspaceId &&
    policy.projectId === review.projectId &&
    policy.ownerUserId === review.ownerUserId &&
    policy.connectionId === review.target.connectionId &&
    policy.provider === review.target.provider &&
    policy.accountId === review.target.accountId &&
    policy.repository === review.target.repository
  );
}

async function resolvePolicy(
  context: ServiceContext,
  projectId: string,
  workspaceId: string,
  input: ReviewPolicyInput,
) {
  const parsed = reviewPolicyInputSchema.parse(input);

  if (parsed.enabled === false) {
    const existing = await context.repositories.projectTaskIntegrations.getPolicy(
      parsed.id,
      projectId,
    );

    if (!existing || existing.workspaceId !== workspaceId) {
      throw new AssistantError("Review policy not found", ErrorType.NOT_FOUND, 404);
    }

    return { ...existing, enabled: false, revision: generateId() };
  }

  const client = await connectTaskReview(context, parsed);

  if (!client.canAutomate) {
    throw new AssistantError(
      "Configure this connection for signed review events before enabling automatic review",
      ErrorType.CONFIGURATION_ERROR,
      400,
    );
  }

  return reviewPolicySchema.parse({
    ...parsed,
    repository: client.repository,
    id: await reviewPolicyIdentity(
      projectId,
      parsed.provider,
      client.connectionId,
      client.repository,
    ),
    workspaceId,
    projectId,
    ownerUserId: context.requireUser().id,
    connectionId: client.connectionId,
    revision: generateId(),
  });
}

export async function setProjectReviewPolicy(
  context: ServiceContext,
  projectId: string,
  input: ReviewPolicyInput,
) {
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const policy = await resolvePolicy(context, projectId, project.workspace_id, input);

  await context.repositories.projectTaskIntegrations.setPolicy(policy);
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: context.requireUser().id,
    action: "project.review.policy_changed",
    targetType: "project",
    targetId: projectId,
    metadata: {
      policyId: policy.id,
      provider: policy.provider,
      enabled: policy.enabled,
      repository: policy.repository,
      revision: policy.revision,
    },
  });

  return { policy };
}

export async function connectOwnedReview(context: ServiceContext, review: PullRequestReview) {
  if (!ownsResource(context.requireUser().id, review.ownerUserId)) {
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
      !policy ||
      policy.ownerUserId !== context.requireUser().id ||
      !matchesReviewPolicy(policy, review)
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
