import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectCapabilityAccess } from "../access";

function createContext(capabilityId: string) {
	return {
		requireUser: vi.fn().mockReturnValue({ id: 7 }),
		repositories: {
			workspaces: {
				getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
				getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
				getMembership: vi.fn().mockResolvedValue({ role: "member" }),
				listProjectCapabilities: vi
					.fn()
					.mockResolvedValue([{ kind: "app", capability_id: capabilityId }]),
			},
		},
	} as unknown as ServiceContext;
}

describe("requireProjectCapabilityAccess", () => {
	it("allows members to use an enabled project capability", async () => {
		await expect(
			requireProjectCapabilityAccess(
				createContext("featured-note-taker"),
				"project-1",
				"app",
				"featured-note-taker",
			),
		).resolves.toBeUndefined();
	});

	it("rejects a capability that is not enabled for the project", async () => {
		await expect(
			requireProjectCapabilityAccess(
				createContext("featured-strudel"),
				"project-1",
				"app",
				"featured-note-taker",
			),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});
