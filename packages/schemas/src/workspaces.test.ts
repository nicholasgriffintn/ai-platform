import { describe, expect, it } from "vitest";

import {
	acceptWorkspaceInvitationSchema,
	createProjectSchema,
	createWorkspaceInvitationSchema,
	updateProjectSchema,
	updateWorkspaceSchema,
} from "./workspaces";

describe("workspace boundary schemas", () => {
	it("normalises invitation email addresses before persistence", () => {
		const result = createWorkspaceInvitationSchema.parse({
			email: "  New.Member@Example.COM  ",
		});

		expect(result).toEqual({ email: "new.member@example.com", role: "member" });
	});

	it("does not allow invitations to grant workspace ownership", () => {
		expect(
			createWorkspaceInvitationSchema.safeParse({
				email: "member@example.com",
				role: "owner",
			}).success,
		).toBe(false);
	});

	it("rejects short invitation tokens at the API boundary", () => {
		expect(acceptWorkspaceInvitationSchema.safeParse({ token: "guessable" }).success).toBe(false);
	});

	it("requires an actual change for workspace and project updates", () => {
		expect(updateWorkspaceSchema.safeParse({}).success).toBe(false);
		expect(updateWorkspaceSchema.safeParse({ description: "Updated" }).success).toBe(true);
		expect(updateProjectSchema.safeParse({}).success).toBe(false);
		expect(updateProjectSchema.safeParse({ instructions: "Updated" }).success).toBe(true);
	});

	it("rejects invalid project colours", () => {
		expect(
			createProjectSchema.safeParse({
				name: "Project",
				colour: "blue",
			}).success,
		).toBe(false);
	});
});
