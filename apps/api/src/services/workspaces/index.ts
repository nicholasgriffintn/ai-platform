import type {
  AddProjectCapabilityInput,
  CreateProjectInput,
  CreateWorkspaceInput,
  CreateWorkspaceInvitationInput,
  UpdateProjectInput,
  UpdateWorkspaceInput,
  WorkspaceDetail,
  WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";
import { deriveProjectColour } from "@ngriffin_uk/polychat-schemas";

import { validateCapabilityReference } from "~/lib/capabilities";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getGitHubAppConnectionForUserInstallation } from "~/services/github/connections";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";

import { requireProjectAccess, requireWorkAccess, requireWorkspaceAccess } from "./access";
import {
  formatProjectDetail,
  formatProjectSummary,
  formatWorkspaceInvitation,
  formatWorkspaceMember,
  formatWorkspaceSummary,
} from "./format";
import { sendWorkspaceInvitationEmail } from "./invitation-email";
import { validateProjectToolConfiguration } from "./projectTools";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

async function validateProjectCodingEnvironment(
  context: ServiceContext,
  userId: number,
  codingEnvironment: CreateProjectInput["codingEnvironment"],
): Promise<void> {
  if (!codingEnvironment) {
    return;
  }

  await getGitHubAppConnectionForUserInstallation(
    context,
    userId,
    codingEnvironment.installationId,
    codingEnvironment.repository,
  );
}

export async function listWorkspaces(context: ServiceContext) {
  const user = requireWorkAccess(context);
  const workspaces = await context.repositories.workspaces.listWorkspaces(user.id);

  return { workspaces: workspaces.map(formatWorkspaceSummary) };
}

export async function createWorkspace(context: ServiceContext, input: CreateWorkspaceInput) {
  const user = requireWorkAccess(context);
  const id = generateId();

  await context.repositories.workspaces.createWorkspace({ id, ...input, userId: user.id });
  await context.repositories.audit.createRecord({
    workspaceId: id,
    actorUserId: user.id,
    action: "workspace.created",
    targetType: "workspace",
    targetId: id,
  });

  return getWorkspace(context, id);
}

export async function getWorkspace(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceDetail> {
  const { workspace, role } = await requireWorkspaceAccess(context, workspaceId);
  const [projects, members, invitations] = await Promise.all([
    context.repositories.workspaces.listProjects(workspaceId),
    context.repositories.workspaces.listMembers(workspaceId),
    role === "member"
      ? Promise.resolve([])
      : context.repositories.workspaces.listInvitations(workspaceId),
  ]);

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    colour: workspace.colour,
    role,
    memberCount: members.length,
    projectCount: projects.length,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
    projects: projects.map(formatProjectSummary),
    members: members.map(formatWorkspaceMember),
    invitations: invitations.map(formatWorkspaceInvitation),
  };
}

export async function updateWorkspaceMember(
  context: ServiceContext,
  workspaceId: string,
  memberUserId: number,
  role: Exclude<WorkspaceRole, "owner">,
) {
  const actor = context.requireUser();
  const access = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const target = await context.repositories.workspaces.getMembership(workspaceId, memberUserId);

  if (!target || target.role === "owner") {
    throw new AssistantError("Workspace member not found", ErrorType.NOT_FOUND, 404);
  }

  if (access.role === "admin" && (target.role === "admin" || role === "admin")) {
    throw new AssistantError(
      "Only the workspace owner can manage administrators",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (actor.id === memberUserId && role !== target.role) {
    throw new AssistantError(
      "Use the leave workspace action for your own membership",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  await context.repositories.workspaces.updateMemberRole(workspaceId, memberUserId, role);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: actor.id,
    action: "workspace.member.role_changed",
    targetType: "user",
    targetId: String(memberUserId),
    metadata: { previousRole: target.role, role },
  });

  return getWorkspace(context, workspaceId);
}

export async function removeWorkspaceMember(
  context: ServiceContext,
  workspaceId: string,
  memberUserId: number,
) {
  const actor = context.requireUser();
  const access = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const target = await context.repositories.workspaces.getMembership(workspaceId, memberUserId);

  if (!target || target.role === "owner") {
    throw new AssistantError("Workspace member not found", ErrorType.NOT_FOUND, 404);
  }

  if (actor.id === memberUserId) {
    throw new AssistantError("Use the leave workspace action", ErrorType.PARAMS_ERROR, 400);
  }

  if (access.role === "admin" && target.role === "admin") {
    throw new AssistantError(
      "Only the workspace owner can remove administrators",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.workspaces.removeMember(workspaceId, memberUserId);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: actor.id,
    action: "workspace.member.removed",
    targetType: "user",
    targetId: String(memberUserId),
    metadata: { role: target.role },
  });

  return getWorkspace(context, workspaceId);
}

export async function leaveWorkspace(context: ServiceContext, workspaceId: string) {
  const user = context.requireUser();
  const { role } = await requireWorkspaceAccess(context, workspaceId);

  if (role === "owner") {
    throw new AssistantError(
      "Transfer ownership before leaving the workspace",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.workspaces.removeMember(workspaceId, user.id);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.member.left",
    targetType: "user",
    targetId: String(user.id),
    metadata: { role },
  });

  return { success: true };
}

export async function transferWorkspaceOwnership(
  context: ServiceContext,
  workspaceId: string,
  newOwnerUserId: number,
) {
  const owner = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  if (owner.id === newOwnerUserId) {
    throw new AssistantError("You already own this workspace", ErrorType.PARAMS_ERROR, 400);
  }

  const target = await context.repositories.workspaces.getMembership(workspaceId, newOwnerUserId);

  if (!target) {
    throw new AssistantError("Workspace member not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.workspaces.transferOwnership(workspaceId, owner.id, newOwnerUserId);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: owner.id,
    action: "workspace.ownership.transferred",
    targetType: "user",
    targetId: String(newOwnerUserId),
    metadata: { previousOwnerUserId: owner.id },
  });

  return getWorkspace(context, workspaceId);
}

export async function updateWorkspace(
  context: ServiceContext,
  workspaceId: string,
  input: UpdateWorkspaceInput,
) {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  await context.repositories.workspaces.updateWorkspace(workspaceId, input);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.updated",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { fields: Object.keys(input) },
  });

  return getWorkspace(context, workspaceId);
}

export async function deleteWorkspace(context: ServiceContext, workspaceId: string) {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.deletion.requested",
    targetType: "workspace",
    targetId: workspaceId,
  });
  await context.repositories.workspaces.deleteWorkspace(workspaceId);

  return { success: true };
}

export async function inviteWorkspaceMember(
  context: ServiceContext,
  workspaceId: string,
  input: CreateWorkspaceInvitationInput,
) {
  const user = context.requireUser();
  const { role, workspace } = await requireWorkspaceAccess(context, workspaceId, [
    "owner",
    "admin",
  ]);

  if (input.role === "admin" && role !== "owner") {
    throw new AssistantError(
      "Only workspace owners can invite administrators",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const members = await context.repositories.workspaces.listMembers(workspaceId);

  if (members.some((member) => member.email.toLowerCase() === input.email)) {
    throw new AssistantError(
      "This person is already a workspace member",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const token = randomHex(64).toLowerCase();
  const invitation = await context.repositories.workspaces.upsertInvitation({
    id: generateId(),
    workspaceId,
    email: input.email,
    role: input.role,
    tokenHash: await sha256Hex(token),
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString(),
  });

  if (!invitation) {
    throw new AssistantError("Unable to create workspace invitation", ErrorType.DATABASE_ERROR);
  }

  const baseUrl = (context.env.APP_BASE_URL ?? "https://polychat.app").replace(/\/$/, "");
  const inviteUrl = `${baseUrl}/work/invitations?token=${encodeURIComponent(token)}`;

  try {
    await sendWorkspaceInvitationEmail(context.env, {
      email: input.email,
      inviteUrl,
      inviterName: user.name,
      role: input.role,
      workspaceName: workspace.name,
    });
  } catch (error) {
    await context.repositories.workspaces.revokeInvitation(workspaceId, invitation.id);
    throw error;
  }

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.invitation.created",
    targetType: "workspace_invitation",
    targetId: invitation.id,
    metadata: { email: input.email, role: input.role },
  });

  return {
    invitation: formatWorkspaceInvitation(invitation),
    inviteUrl,
  };
}

export async function acceptWorkspaceInvitation(context: ServiceContext, token: string) {
  const user = requireWorkAccess(context);
  const invitation = await context.repositories.workspaces.getInvitationByTokenHash(
    await sha256Hex(token),
  );

  if (!invitation || invitation.status !== "pending") {
    throw new AssistantError(
      "Invitation is invalid or has already been used",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new AssistantError("Invitation has expired", ErrorType.PARAMS_ERROR, 410);
  }

  if (user.email.trim().toLowerCase() !== invitation.email) {
    throw new AssistantError(
      "Sign in with the email address that received this invitation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.workspaces.acceptInvitation(invitation, user.id);
  await context.repositories.audit.createRecord({
    workspaceId: invitation.workspace_id,
    actorUserId: user.id,
    action: "workspace.invitation.accepted",
    targetType: "workspace_invitation",
    targetId: invitation.id,
    metadata: { role: invitation.role },
  });

  return getWorkspace(context, invitation.workspace_id);
}

export async function revokeWorkspaceInvitation(
  context: ServiceContext,
  workspaceId: string,
  invitationId: string,
) {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const revoked = await context.repositories.workspaces.revokeInvitation(workspaceId, invitationId);

  if (!revoked) {
    throw new AssistantError("Workspace invitation not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.invitation.revoked",
    targetType: "workspace_invitation",
    targetId: invitationId,
  });

  return { success: true };
}

export async function createProject(
  context: ServiceContext,
  workspaceId: string,
  input: CreateProjectInput,
) {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  await validateProjectCodingEnvironment(context, user.id, input.codingEnvironment);
  const id = generateId();

  await context.repositories.workspaces.createProject({
    id,
    workspaceId,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    colour: input.colour ?? deriveProjectColour(input.name, input.description),
    codingEnvironment: input.codingEnvironment,
    createdBy: user.id,
  });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "project.created",
    targetType: "project",
    targetId: id,
  });

  return getProject(context, id);
}

export async function getProject(context: ServiceContext, projectId: string) {
  const { project } = await requireProjectAccess(context, projectId);
  const [capabilities, conversations] = await Promise.all([
    context.repositories.workspaces.listProjectCapabilities(projectId),
    context.repositories.workspaces.listProjectConversations(projectId),
  ]);

  return formatProjectDetail({ project, capabilities, conversations });
}

export async function updateProject(
  context: ServiceContext,
  projectId: string,
  input: UpdateProjectInput,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const { codingEnvironment, ...projectFields } = input;

  if (codingEnvironment !== undefined) {
    await validateProjectCodingEnvironment(context, user.id, codingEnvironment);
  }

  const codingUpdates =
    codingEnvironment === undefined
      ? {}
      : {
          coding_enabled: codingEnvironment ? 1 : 0,
          coding_installation_id: codingEnvironment?.installationId ?? null,
          coding_repository: codingEnvironment?.repository ?? null,
          coding_prompt_strategy: codingEnvironment?.promptStrategy ?? "auto",
          coding_should_commit: codingEnvironment?.shouldCommit ?? true,
          coding_timeout_seconds: codingEnvironment?.timeoutSeconds ?? 900,
        };

  await context.repositories.workspaces.updateProject(projectId, {
    ...projectFields,
    ...codingUpdates,
  });
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.updated",
    targetType: "project",
    targetId: projectId,
    metadata: { fields: Object.keys(input) },
  });

  return getProject(context, projectId);
}

export async function archiveProject(context: ServiceContext, projectId: string) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  await context.repositories.workspaces.updateProject(projectId, {
    archived_at: new Date().toISOString(),
  });
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.archived",
    targetType: "project",
    targetId: projectId,
  });

  return { success: true };
}

export async function addProjectCapability(
  context: ServiceContext,
  projectId: string,
  input: AddProjectCapabilityInput,
) {
  const user = context.requireUser();
  const { project, role } = await requireProjectAccess(context, projectId);

  if (input.kind === "tool" && role === "member") {
    throw new AssistantError(
      "Only project admins can manage project tools",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const existing = (await context.repositories.workspaces.listProjectCapabilities(projectId)).find(
    (capability) =>
      capability.kind === input.kind && capability.capability_id === input.capabilityId,
  );

  if (existing && input.kind !== "tool" && existing.created_by !== user.id) {
    throw new AssistantError(
      "Only the member who attached this capability can manage it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await validateCapabilityReference(input.kind, input.capabilityId, context);
  const configuration =
    input.kind === "tool"
      ? validateProjectToolConfiguration(input.capabilityId, input.configuration)
      : input.configuration;
  const capabilityRowId = existing?.id ?? generateId();

  await context.repositories.workspaces.addProjectCapability({
    id: capabilityRowId,
    projectId,
    kind: input.kind,
    capabilityId: input.capabilityId,
    configuration,
    createdBy: user.id,
  });
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.capability.added",
    targetType: "project_capability",
    targetId: capabilityRowId,
    metadata: { projectId, kind: input.kind, capabilityId: input.capabilityId },
  });

  return getProject(context, projectId);
}

export async function removeProjectCapability(
  context: ServiceContext,
  projectId: string,
  capabilityId: string,
) {
  const user = context.requireUser();
  const { project, role } = await requireProjectAccess(context, projectId);
  const capability = (
    await context.repositories.workspaces.listProjectCapabilities(projectId)
  ).find((candidate) => candidate.id === capabilityId);

  if (!capability) {
    throw new AssistantError("Project capability not found", ErrorType.NOT_FOUND, 404);
  }

  if (capability.kind === "tool") {
    if (role === "member") {
      throw new AssistantError(
        "Only project admins can manage project tools",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  } else if (capability.created_by !== user.id) {
    throw new AssistantError(
      "Only the member who attached this capability can manage it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.workspaces.removeProjectCapability(projectId, capabilityId);
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.capability.removed",
    targetType: "project_capability",
    targetId: capabilityId,
    metadata: { projectId, kind: capability.kind, capabilityId: capability.capability_id },
  });

  return getProject(context, projectId);
}
