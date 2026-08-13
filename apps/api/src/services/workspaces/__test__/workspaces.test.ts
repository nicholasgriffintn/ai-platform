import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/email", () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import type { ServiceContext } from "~/lib/context/serviceContext";
import { deriveProjectColour } from "@ngriffin_uk/polychat-schemas";
import type {
	ProjectCapabilityRow,
	ProjectRow,
	WorkspaceInvitationRow,
	WorkspaceMemberRow,
	WorkspaceRow,
} from "~/repositories/WorkspaceRepository";
import { sha256Hex } from "~/utils/crypto";
import { ErrorType } from "~/utils/errors";
import { sendEmail } from "~/services/email";
import { assistantRecipes } from "~/services/apps/recipes/catalog";
import {
	acceptWorkspaceInvitation,
	addProjectCapability,
	createProject,
	deleteWorkspace,
	getProject,
	getWorkspace,
	inviteWorkspaceMember,
	listWorkspaces,
	removeProjectCapability,
} from "../index";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const WORKSPACE_ID = "workspace-1";
const PROJECT_ID = "project-1";

const workspace: WorkspaceRow = {
	id: WORKSPACE_ID,
	name: "Product",
	description: "Product planning",
	colour: "#E8643C",
	created_by: 1,
	created_at: "2026-08-01T09:00:00.000Z",
	updated_at: null,
};

const owner: WorkspaceMemberRow = {
	user_id: 1,
	name: "Owner",
	email: "owner@example.com",
	avatar_url: null,
	role: "owner",
	joined_at: "2026-08-01T09:00:00.000Z",
};

const project: ProjectRow = {
	id: PROJECT_ID,
	workspace_id: WORKSPACE_ID,
	name: "Launch",
	description: "Launch planning",
	instructions: "Keep decisions concise.",
	colour: "#2563EB",
	created_by: 1,
	archived_at: null,
	created_at: "2026-08-02T09:00:00.000Z",
	updated_at: null,
	conversation_count: 0,
	capability_count: 0,
};

function createHarness(params?: {
	user?: { id: number; email: string; plan_id?: string };
	role?: "owner" | "admin" | "member" | null;
}) {
	const user = {
		id: 1,
		email: "owner@example.com",
		plan_id: "pro",
		...params?.user,
	};
	const role = params?.role === undefined ? "owner" : params.role;
	const repositories = {
		listWorkspaces: vi.fn().mockResolvedValue([]),
		getWorkspace: vi.fn().mockResolvedValue(workspace),
		getMembership: vi.fn().mockResolvedValue(role ? { role } : null),
		listProjects: vi.fn().mockResolvedValue([]),
		listMembers: vi.fn().mockResolvedValue([owner]),
		listInvitations: vi.fn().mockResolvedValue([]),
		upsertInvitation: vi.fn(),
		revokeInvitation: vi.fn().mockResolvedValue(true),
		getInvitationByTokenHash: vi.fn(),
		acceptInvitation: vi.fn().mockResolvedValue(undefined),
		createProject: vi.fn().mockResolvedValue(undefined),
		deleteWorkspace: vi.fn().mockResolvedValue(undefined),
		getProject: vi.fn().mockResolvedValue(project),
		listProjectCapabilities: vi.fn().mockResolvedValue([]),
		addProjectCapability: vi.fn().mockResolvedValue(undefined),
		removeProjectCapability: vi.fn().mockResolvedValue(undefined),
		listProjectConversations: vi.fn().mockResolvedValue([]),
	};
	const audit = { createRecord: vi.fn().mockResolvedValue(undefined) };
	const context = {
		env: { APP_BASE_URL: "https://work.polychat.test/" },
		requireUser: vi.fn().mockReturnValue(user),
		repositories: { workspaces: repositories, audit },
	} as unknown as ServiceContext;

	return { context, repositories, audit };
}

describe("Work entitlement", () => {
	it("does not query workspace data for a signed-in user without Pro", async () => {
		const { context, repositories } = createHarness({
			user: { id: 2, email: "free@example.com", plan_id: "free" },
		});

		await expect(listWorkspaces(context)).rejects.toMatchObject({ statusCode: 403 });
		expect(repositories.listWorkspaces).not.toHaveBeenCalled();
	});
});

describe("workspace deletion", () => {
	it("records the deletion request before removing the workspace", async () => {
		const { context, repositories, audit } = createHarness();

		await deleteWorkspace(context, WORKSPACE_ID);

		expect(audit.createRecord).toHaveBeenCalledWith({
			workspaceId: WORKSPACE_ID,
			actorUserId: 1,
			action: "workspace.deletion.requested",
			targetType: "workspace",
			targetId: WORKSPACE_ID,
		});
		expect(repositories.deleteWorkspace).toHaveBeenCalledWith(WORKSPACE_ID);
		expect(audit.createRecord.mock.invocationCallOrder[0]).toBeLessThan(
			repositories.deleteWorkspace.mock.invocationCallOrder[0],
		);
	});
});

function invitation(overrides: Partial<WorkspaceInvitationRow> = {}): WorkspaceInvitationRow {
	return {
		id: "invitation-1",
		workspace_id: WORKSPACE_ID,
		email: "invitee@example.com",
		role: "member",
		token_hash: "stored-hash",
		status: "pending",
		invited_by: 1,
		accepted_by: null,
		expires_at: "2026-08-17T12:00:00.000Z",
		accepted_at: null,
		created_at: "2026-08-10T12:00:00.000Z",
		updated_at: null,
		...overrides,
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("workspace invitation lifecycle", () => {
	it("stores only a hash of the invitation token and returns the raw token in the invite URL", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { context, repositories } = createHarness();
		repositories.upsertInvitation.mockImplementation(async (input) =>
			invitation({
				id: input.id,
				email: input.email,
				role: input.role,
				token_hash: input.tokenHash,
				expires_at: input.expiresAt,
			}),
		);

		const result = await inviteWorkspaceMember(context, WORKSPACE_ID, {
			email: "invitee@example.com",
			role: "member",
		});

		const inviteUrl = new URL(result.inviteUrl);
		const rawToken = inviteUrl.searchParams.get("token");
		const persisted = repositories.upsertInvitation.mock.calls[0][0];

		expect(inviteUrl.origin).toBe("https://work.polychat.test");
		if (!rawToken) throw new Error("Invite URL did not contain a token");
		expect(rawToken).toHaveLength(64);
		expect(persisted.tokenHash).toBe(await sha256Hex(rawToken));
		expect(persisted.tokenHash).not.toBe(rawToken);
		expect(persisted.expiresAt).toBe("2026-08-17T12:00:00.000Z");
		expect(result.invitation).not.toHaveProperty("token_hash");
		expect(sendEmail).toHaveBeenCalledWith(
			context.env,
			"invitee@example.com",
			expect.stringContaining("You’re invited to join Product"),
			expect.stringContaining("https://work.polychat.test/work/invitations?token="),
			expect.stringContaining("Accept invitation"),
		);
	});

	it("revokes an invitation when its email cannot be delivered", async () => {
		const { context, repositories } = createHarness();
		repositories.upsertInvitation.mockResolvedValue(invitation());
		vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Email provider unavailable"));

		await expect(
			inviteWorkspaceMember(context, WORKSPACE_ID, {
				email: "invitee@example.com",
				role: "member",
			}),
		).rejects.toThrow("Email provider unavailable");
		expect(repositories.revokeInvitation).toHaveBeenCalledWith(WORKSPACE_ID, "invitation-1");
	});

	it("binds acceptance to the invited email address", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { context, repositories } = createHarness({
			user: { id: 2, email: "different@example.com" },
		});
		repositories.getInvitationByTokenHash.mockResolvedValue(invitation());

		await expect(acceptWorkspaceInvitation(context, "a".repeat(64))).rejects.toMatchObject({
			type: ErrorType.FORBIDDEN,
			statusCode: 403,
			message: "Sign in with the email address that received this invitation",
		});
		expect(repositories.acceptInvitation).not.toHaveBeenCalled();
	});

	it("rejects expired invitations without creating a membership", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { context, repositories } = createHarness({
			user: { id: 2, email: "invitee@example.com" },
		});
		repositories.getInvitationByTokenHash.mockResolvedValue(
			invitation({ expires_at: "2026-08-10T11:59:59.999Z" }),
		);

		await expect(acceptWorkspaceInvitation(context, "a".repeat(64))).rejects.toMatchObject({
			message: "Invitation has expired",
			statusCode: 410,
		});
		expect(repositories.acceptInvitation).not.toHaveBeenCalled();
	});

	it("accepts a valid invitation once and rejects replay with the same token", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { context, repositories } = createHarness({
			user: { id: 2, email: " INVITEE@example.com " },
			role: "member",
		});
		let storedInvitation = invitation();
		repositories.getInvitationByTokenHash.mockImplementation(async () => storedInvitation);
		repositories.acceptInvitation.mockImplementation(async () => {
			storedInvitation = invitation({ status: "accepted", token_hash: "consumed:invitation-1" });
		});

		const result = await acceptWorkspaceInvitation(context, "a".repeat(64));

		expect(repositories.acceptInvitation).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "invitation-1",
				status: "pending",
			}),
			2,
		);
		expect(result).toMatchObject({ id: WORKSPACE_ID, role: "member", invitations: [] });
		await expect(acceptWorkspaceInvitation(context, "a".repeat(64))).rejects.toMatchObject({
			type: ErrorType.NOT_FOUND,
			statusCode: 404,
		});
		expect(repositories.acceptInvitation).toHaveBeenCalledTimes(1);
	});

	it("prevents administrators from escalating invitations to the admin role", async () => {
		const { context, repositories } = createHarness({ role: "admin" });

		await expect(
			inviteWorkspaceMember(context, WORKSPACE_ID, {
				email: "invitee@example.com",
				role: "admin",
			}),
		).rejects.toMatchObject({ type: ErrorType.FORBIDDEN, statusCode: 403 });
		expect(repositories.upsertInvitation).not.toHaveBeenCalled();
	});
});

describe("workspace and project isolation", () => {
	it("derives a stable colour when creating a project without one", async () => {
		const { context, repositories } = createHarness();

		await createProject(context, WORKSPACE_ID, {
			name: "Customer research",
			description: "Summarise interview themes",
			instructions: "",
		});

		expect(repositories.createProject).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Customer research",
				colour: deriveProjectColour("Customer research", "Summarise interview themes"),
			}),
		);
	});

	it("preserves a colour supplied when creating a project", async () => {
		const { context, repositories } = createHarness();

		await createProject(context, WORKSPACE_ID, {
			name: "Customer research",
			description: "Summarise interview themes",
			instructions: "",
			colour: "#2563EB",
		});

		expect(repositories.createProject).toHaveBeenCalledWith(
			expect.objectContaining({ colour: "#2563EB" }),
		);
	});

	it("does not disclose pending invitations to ordinary workspace members", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "member@example.com" },
			role: "member",
		});

		const result = await getWorkspace(context, WORKSPACE_ID);

		expect(result.role).toBe("member");
		expect(result.invitations).toEqual([]);
		expect(repositories.listInvitations).not.toHaveBeenCalled();
	});

	it("prevents ordinary members from creating projects", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "member@example.com" },
			role: "member",
		});

		await expect(
			createProject(context, WORKSPACE_ID, {
				name: "Restricted project",
				description: "",
				instructions: "",
				colour: "#2563EB",
			}),
		).rejects.toMatchObject({ type: ErrorType.FORBIDDEN, statusCode: 403 });
		expect(repositories.createProject).not.toHaveBeenCalled();
	});

	it("does not load project contents when the user is outside its workspace", async () => {
		const { context, repositories } = createHarness({
			user: { id: 4, email: "outsider@example.com" },
			role: null,
		});

		await expect(getProject(context, PROJECT_ID)).rejects.toMatchObject({
			type: ErrorType.NOT_FOUND,
			statusCode: 404,
		});
		expect(repositories.getMembership).toHaveBeenCalledWith(WORKSPACE_ID, 4);
		expect(repositories.listProjectCapabilities).not.toHaveBeenCalled();
		expect(repositories.listProjectConversations).not.toHaveBeenCalled();
	});
});

describe("project capability ownership", () => {
	const recipeCapability: ProjectCapabilityRow = {
		id: "capability-1",
		project_id: PROJECT_ID,
		kind: "recipe",
		capability_id: assistantRecipes[0].id,
		configuration: {},
		created_by: 2,
		created_at: "2026-08-10T12:00:00.000Z",
	};

	it("lets project members attach recipes under their own ownership", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "member@example.com" },
			role: "member",
		});

		await addProjectCapability(context, PROJECT_ID, {
			kind: "recipe",
			capabilityId: assistantRecipes[0].id,
			configuration: {},
		});

		expect(repositories.addProjectCapability).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: PROJECT_ID,
				kind: "recipe",
				capabilityId: assistantRecipes[0].id,
				createdBy: 3,
			}),
		);
	});

	it("prevents another project member from changing or removing an attached recipe", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "member@example.com" },
			role: "member",
		});
		repositories.listProjectCapabilities.mockResolvedValue([recipeCapability]);

		await expect(
			addProjectCapability(context, PROJECT_ID, {
				kind: "recipe",
				capabilityId: recipeCapability.capability_id,
				configuration: {},
			}),
		).rejects.toMatchObject({ statusCode: 403 });
		await expect(
			removeProjectCapability(context, PROJECT_ID, recipeCapability.id),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(repositories.addProjectCapability).not.toHaveBeenCalled();
		expect(repositories.removeProjectCapability).not.toHaveBeenCalled();
	});

	it("lets the attaching member remove their recipe capability", async () => {
		const { context, repositories } = createHarness({
			user: { id: 2, email: "creator@example.com" },
			role: "member",
		});
		repositories.listProjectCapabilities.mockResolvedValue([recipeCapability]);

		await removeProjectCapability(context, PROJECT_ID, recipeCapability.id);

		expect(repositories.removeProjectCapability).toHaveBeenCalledWith(
			PROJECT_ID,
			recipeCapability.id,
		);
	});

	it("keeps project tools restricted to project admins", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "member@example.com" },
			role: "member",
		});

		await expect(
			addProjectCapability(context, PROJECT_ID, {
				kind: "tool",
				capabilityId: "web_fetch",
				configuration: {},
			}),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(repositories.addProjectCapability).not.toHaveBeenCalled();
	});

	it("lets project admins update a tool attached by another admin", async () => {
		const { context, repositories } = createHarness({
			user: { id: 3, email: "admin@example.com" },
			role: "admin",
		});
		repositories.listProjectCapabilities.mockResolvedValue([
			{
				...recipeCapability,
				id: "tool-capability-1",
				kind: "tool",
				capability_id: "web_fetch",
			},
		]);

		await addProjectCapability(context, PROJECT_ID, {
			kind: "tool",
			capabilityId: "web_fetch",
			configuration: {},
		});

		expect(repositories.addProjectCapability).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "tool-capability-1",
				createdBy: 3,
			}),
		);
	});
});
