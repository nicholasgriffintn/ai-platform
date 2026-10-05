import {
  reviewPolicyInputSchema,
  reviewPolicySchema,
  type ReviewPolicyInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { connectTaskReview } from "../infrastructure/integrations";
import { reviewPolicyIdentity } from "./integration-identity";

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
