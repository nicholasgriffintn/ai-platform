import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { requireTeammateAccess, TEAMMATE_CAPABILITY_KIND } from "./access";
import { archiveProjectTeammateContexts } from "./context-lifecycle";

/**
 * A workspace default reaches every project, so removing one from a single project is recorded
 * as an exclusion rather than by deleting a grant that was never there.
 */
export async function removeInheritedTeammateFromProject(
  context: ServiceContext,
  projectId: string,
  teammateId: string,
): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();
  const { project, role } = await requireProjectAccess(context, projectId);

  if (role === "member") {
    throw new AssistantError(
      "Only project admins can remove a default teammate",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const teammate = await context.repositories.teammates.getTeammateById(teammateId);
  const isPlatformDefault = teammate?.owner_scope_type === "platform";
  const isWorkspaceDefault =
    teammate?.owner_scope_type === "workspace" && teammate.owner_scope_id === project.workspace_id;

  if (!teammate || (!isPlatformDefault && !isWorkspaceDefault)) {
    throw new AssistantError(
      "That teammate is not a default for this project",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  await context.repositories.workspaces.addProjectCapability({
    id: generateId(),
    projectId,
    kind: TEAMMATE_CAPABILITY_KIND,
    capabilityId: teammateId,
    createdBy: user.id,
    excluded: true,
  });
  await archiveProjectTeammateContexts(context, projectId, teammateId);

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.teammate.removed",
    targetType: "project_capability",
    targetId: teammateId,
    metadata: { projectId, teammateId },
  });
}

export async function restoreInheritedTeammateToProject(
  context: ServiceContext,
  projectId: string,
  teammateId: string,
): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();
  const { project, role } = await requireProjectAccess(context, projectId);

  if (role === "member") {
    throw new AssistantError(
      "Only project admins can restore a default teammate",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.workspaces.removeProjectCapabilityByCapabilityId(
    projectId,
    TEAMMATE_CAPABILITY_KIND,
    teammateId,
  );

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.teammate.restored",
    targetType: "project_capability",
    targetId: teammateId,
    metadata: { projectId, teammateId },
  });
}

export async function recordTeammateFeedback(
  context: ServiceContext,
  teammateId: string,
  input: { verdict: "good" | "bad"; conversationId?: string; note?: string },
): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();

  await requireTeammateAccess(context, teammateId, "read", user.id);
  await context.repositories.teammateFeedback.record({
    teammateId,
    userId: user.id,
    conversationId: input.conversationId ?? null,
    verdict: input.verdict,
    ...(input.note ? { note: input.note } : {}),
  });
}
