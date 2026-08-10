import type {
	AddProjectCapabilityInput,
	CreateProjectInput,
	CreateWorkspaceInput,
	CreateWorkspaceInvitationInput,
	UpdateProjectInput,
	UpdateWorkspaceInput,
	WorkspaceDetail,
} from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";
import { requireProjectAccess, requireWorkspaceAccess } from "./access";
import { validateProjectToolConfiguration } from "./projectTools";
import {
	formatProjectDetail,
	formatProjectSummary,
	formatWorkspaceInvitation,
	formatWorkspaceMember,
	formatWorkspaceSummary,
} from "./format";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function listWorkspaces(context: ServiceContext) {
	const user = context.requireUser();
	const workspaces = await context.repositories.workspaces.listWorkspaces(user.id);
	return { workspaces: workspaces.map(formatWorkspaceSummary) };
}

export async function createWorkspace(context: ServiceContext, input: CreateWorkspaceInput) {
	const user = context.requireUser();
	const id = generateId();
	await context.repositories.workspaces.createWorkspace({ id, ...input, userId: user.id });
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

export async function updateWorkspace(
	context: ServiceContext,
	workspaceId: string,
	input: UpdateWorkspaceInput,
) {
	await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
	await context.repositories.workspaces.updateWorkspace(workspaceId, input);
	return getWorkspace(context, workspaceId);
}

export async function deleteWorkspace(context: ServiceContext, workspaceId: string) {
	await requireWorkspaceAccess(context, workspaceId, ["owner"]);
	await context.repositories.workspaces.deleteWorkspace(workspaceId);
	return { success: true };
}

export async function inviteWorkspaceMember(
	context: ServiceContext,
	workspaceId: string,
	input: CreateWorkspaceInvitationInput,
) {
	const user = context.requireUser();
	const { role } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
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
	return {
		invitation: formatWorkspaceInvitation(invitation),
		inviteUrl: `${baseUrl}/work/invitations?token=${encodeURIComponent(token)}`,
	};
}

export async function acceptWorkspaceInvitation(context: ServiceContext, token: string) {
	const user = context.requireUser();
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
	return getWorkspace(context, invitation.workspace_id);
}

export async function revokeWorkspaceInvitation(
	context: ServiceContext,
	workspaceId: string,
	invitationId: string,
) {
	await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
	await context.repositories.workspaces.revokeInvitation(workspaceId, invitationId);
	return { success: true };
}

export async function createProject(
	context: ServiceContext,
	workspaceId: string,
	input: CreateProjectInput,
) {
	const user = context.requireUser();
	await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
	const id = generateId();
	await context.repositories.workspaces.createProject({
		id,
		workspaceId,
		...input,
		createdBy: user.id,
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
	await requireProjectAccess(context, projectId, ["owner", "admin"]);
	await context.repositories.workspaces.updateProject(projectId, input);
	return getProject(context, projectId);
}

export async function archiveProject(context: ServiceContext, projectId: string) {
	await requireProjectAccess(context, projectId, ["owner", "admin"]);
	await context.repositories.workspaces.updateProject(projectId, {
		archived_at: new Date().toISOString(),
	});
	return { success: true };
}

export async function addProjectCapability(
	context: ServiceContext,
	projectId: string,
	input: AddProjectCapabilityInput,
) {
	const user = context.requireUser();
	await requireProjectAccess(context, projectId, ["owner", "admin"]);
	const configuration =
		input.kind === "tool"
			? validateProjectToolConfiguration(input.capabilityId, input.configuration)
			: input.configuration;
	await context.repositories.workspaces.addProjectCapability({
		id: generateId(),
		projectId,
		kind: input.kind,
		capabilityId: input.capabilityId,
		configuration,
		createdBy: user.id,
	});
	return getProject(context, projectId);
}

export async function removeProjectCapability(
	context: ServiceContext,
	projectId: string,
	capabilityId: string,
) {
	await requireProjectAccess(context, projectId, ["owner", "admin"]);
	await context.repositories.workspaces.removeProjectCapability(projectId, capabilityId);
	return getProject(context, projectId);
}
