import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { TeammateFeedbackRepository } from "~/modules/teammates/infrastructure/TeammateFeedbackRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

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
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  const teammate = await context.repositories.get(TeammateRepository).getTeammateById(teammateId);
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

  await context.repositories.get(WorkspaceRepository).addProjectCapability({
    id: generateId(),
    projectId,
    kind: TEAMMATE_CAPABILITY_KIND,
    capabilityId: teammateId,
    createdBy: user.id,
    excluded: true,
  });
  await archiveProjectTeammateContexts(context, projectId, teammateId);

  await context.repositories.get(AuditRepository).createRecord({
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
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  await context.repositories
    .get(WorkspaceRepository)
    .removeProjectCapabilityByCapabilityId(projectId, TEAMMATE_CAPABILITY_KIND, teammateId);

  await context.repositories.get(AuditRepository).createRecord({
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
  await context.repositories.get(TeammateFeedbackRepository).record({
    teammateId,
    userId: user.id,
    conversationId: input.conversationId ?? null,
    verdict: input.verdict,
    ...(input.note ? { note: input.note } : {}),
  });
}
