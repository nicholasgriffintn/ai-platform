import { beforeEach, describe, expect, it, vi } from "vitest";
import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@assistant/schemas";

import { SandboxRunDispatchHandler } from "../SandboxRunDispatchHandler";
import { startRunCoordinatorDispatchFiber } from "~/services/apps/sandbox/run-coordinator";

vi.mock("~/services/apps/sandbox/dispatch", () => ({
	isSandboxRunDispatchMessage: vi.fn((value: unknown) => {
		return (
			!!value &&
			typeof value === "object" &&
			(value as { kind?: unknown }).kind === SANDBOX_RUN_DISPATCH_TASK_TYPE
		);
	}),
}));
vi.mock("~/services/apps/sandbox/run-coordinator", () => ({
	startRunCoordinatorDispatchFiber: vi.fn(),
}));

describe("SandboxRunDispatchHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects invalid task payloads", async () => {
		const handler = new SandboxRunDispatchHandler();
		const result = await handler.handle(
			{
				taskId: "task-1",
				task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				task_data: { kind: "invalid" },
				priority: 5,
			} as any,
			{} as any,
		);

		expect(result.status).toBe("error");
		expect(result.message).toContain("Invalid sandbox dispatch");
		expect(startRunCoordinatorDispatchFiber).not.toHaveBeenCalled();
	});

	it("processes valid sandbox dispatch messages", async () => {
		vi.mocked(startRunCoordinatorDispatchFiber).mockResolvedValue({
			fiberId: "fiber-1",
			name: "sandbox-run-dispatch",
			status: "running",
			accepted: true,
			createdAt: 1773576000000,
		});
		const handler = new SandboxRunDispatchHandler();
		const result = await handler.handle(
			{
				taskId: "task-1",
				task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				task_data: {
					kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
					runId: "run-123",
					recordId: "record-1",
					userId: 7,
					payload: {
						installationId: 1,
						repo: "owner/repo",
						task: "Task",
						shouldCommit: false,
					},
				},
				priority: 5,
			} as any,
			{} as any,
		);

		expect(result.status).toBe("success");
		expect(result.data).toMatchObject({
			runId: "run-123",
			fiberId: "fiber-1",
			accepted: true,
		});
		expect(startRunCoordinatorDispatchFiber).toHaveBeenCalledWith({
			env: {},
			runId: "run-123",
			message: expect.objectContaining({
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-123",
			}),
		});
	});
});
