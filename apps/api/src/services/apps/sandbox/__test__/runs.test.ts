import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSandboxRunControlState } from "../runs";
import { getRunCoordinatorControl } from "../run-coordinator";

vi.mock("../run-coordinator", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../run-coordinator")>();
	return {
		...actual,
		getRunCoordinatorControl: vi.fn(),
	};
});

function buildRunData(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		runId: "run-123",
		installationId: 11,
		repo: "owner/repo",
		task: "Implement feature",
		model: "mistral-large",
		shouldCommit: true,
		status: "running",
		startedAt: "2026-02-17T12:00:00.000Z",
		updatedAt: "2026-02-17T12:00:05.000Z",
		...overrides,
	});
}

describe("sandbox runs service", () => {
	const mockGetActivityByGroup = vi.fn();
	const mockGetRunCoordinatorControl = vi.mocked(getRunCoordinatorControl);

	const context = {
		env: {},
		repositories: {
			activities: {
				getActivityByGroup: mockGetActivityByGroup,
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns paused control state for paused runs", async () => {
		mockGetRunCoordinatorControl.mockResolvedValue(null);
		mockGetActivityByGroup.mockResolvedValue({
			id: "record-1",
			created_by_user_id: 42,
			project_id: null,
			data: buildRunData({
				status: "paused",
				pauseReason: "Paused from dashboard",
				timeoutSeconds: 1200,
			}),
		});

		const control = await getSandboxRunControlState({
			context,
			userId: 42,
			runId: "run-123",
		});

		expect(control).toMatchObject({
			runId: "run-123",
			state: "paused",
			pauseReason: "Paused from dashboard",
			timeoutSeconds: 1200,
		});
	});

	it("uses coordinator control when available", async () => {
		mockGetActivityByGroup.mockResolvedValue({
			id: "record-1",
			created_by_user_id: 42,
			project_id: null,
			data: buildRunData(),
		});
		mockGetRunCoordinatorControl.mockResolvedValue({
			runId: "run-123",
			state: "running",
			updatedAt: "2026-02-17T12:00:10.000Z",
			timeoutSeconds: 1200,
		});

		const control = await getSandboxRunControlState({
			context,
			userId: 42,
			runId: "run-123",
		});

		expect(control).toMatchObject({
			runId: "run-123",
			state: "running",
			timeoutSeconds: 1200,
		});
		expect(mockGetActivityByGroup).toHaveBeenCalled();
	});

	it("allows a project member to read a collaborator's run control", async () => {
		mockGetRunCoordinatorControl.mockResolvedValue(null);
		mockGetActivityByGroup.mockResolvedValue({
			id: "record-1",
			created_by_user_id: 7,
			project_id: "project-1",
			data: buildRunData(),
		});
		const projectContext = {
			...context,
			requireUser: vi.fn().mockReturnValue({ id: 42, plan_id: "pro" }),
			repositories: {
				...context.repositories,
				workspaces: {
					getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
					getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
					getMembership: vi.fn().mockResolvedValue({ role: "member" }),
				},
			},
		};

		await expect(
			getSandboxRunControlState({ context: projectContext as any, userId: 42, runId: "run-123" }),
		).resolves.toMatchObject({ runId: "run-123", state: "running" });
	});
});
