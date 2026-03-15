import { beforeEach, describe, expect, it, vi } from "vitest";
import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@assistant/schemas";

import { SandboxRunDispatchHandler } from "../SandboxRunDispatchHandler";
import { processSandboxRunDispatch } from "~/services/apps/sandbox/dispatch";

vi.mock("~/services/apps/sandbox/dispatch", () => ({
	processSandboxRunDispatch: vi.fn(),
	isSandboxRunDispatchMessage: vi.fn((value: unknown) => {
		return (
			!!value &&
			typeof value === "object" &&
			(value as { kind?: unknown }).kind === SANDBOX_RUN_DISPATCH_TASK_TYPE
		);
	}),
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
		expect(processSandboxRunDispatch).not.toHaveBeenCalled();
	});

	it("processes valid sandbox dispatch messages", async () => {
		vi.mocked(processSandboxRunDispatch).mockResolvedValue(undefined);
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
		expect(processSandboxRunDispatch).toHaveBeenCalledWith({
			env: {},
			message: expect.objectContaining({
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-123",
			}),
		});
	});
});
