import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { IRequest } from "~/types";
import { run_code_review, run_feature_implementation, run_test_suite } from "../sandbox";

vi.mock("~/services/apps/sandbox/execute-stream", () => ({
	executeSandboxRunStream: vi.fn(),
}));

function createSandboxStream(events: unknown[], runId = "run-123"): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const event of events) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				}
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		}),
		{
			headers: {
				"Content-Type": "text/event-stream",
				"X-Sandbox-Run-Id": runId,
			},
		},
	);
}

describe("sandbox function tools", () => {
	const request: IRequest = {
		env: {
			ENV: "production",
			API_BASE_URL: "https://api.polychat.app",
		} as any,
		user: {
			id: 42,
		} as any,
		context: {} as any,
		request: {
			model: "gpt-5.4",
			temperature: 0.2,
			top_p: 0.9,
			max_tokens: 4096,
			reasoning: {
				effort: "high",
			},
			verbosity: "low",
			options: {
				sandbox: {
					installationId: 78910,
					repo: "owner/repo",
					promptStrategy: "auto",
					shouldCommit: true,
					timeoutSeconds: 900,
				},
			},
		} as any,
	};

	const createToolContext = (emitToolResult = vi.fn()) => ({
		completionId: "completion-id",
		env: request.env,
		user: request.user,
		request,
		emitToolResult,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(executeSandboxRunStream).mockImplementation(async () =>
			createSandboxStream([
				{
					type: "run_queued",
					runId: "run-123",
					repo: "owner/repo",
					timestamp: "2026-05-23T10:00:00.000Z",
				},
				{
					type: "planning_completed",
					runId: "run-123",
					plan: "- Add tests",
					timestamp: "2026-05-23T10:00:01.000Z",
				},
				{
					type: "run_completed",
					runId: "run-123",
					completedAt: "2026-05-23T10:00:02.000Z",
					timestamp: "2026-05-23T10:00:02.000Z",
					result: {
						success: true,
						summary: "done",
						logs: "logs",
						diff: "diff",
						branchName: "sandbox/run-123",
					},
				},
			]),
		);
	});

	it("starts a persisted sandbox run and streams structured chat messages", async () => {
		const emitToolResult = vi.fn();

		const result = await run_feature_implementation.execute(
			{
				task: "Add tests",
			},
			createToolContext(emitToolResult),
		);

		expect(executeSandboxRunStream).toHaveBeenCalledWith({
			env: request.env,
			context: request.context,
			user: request.user,
			payload: expect.objectContaining({
				installationId: 78910,
				repo: "owner/repo",
				task: "Add tests",
				taskType: "feature-implementation",
				model: "gpt-5.4",
				promptStrategy: "auto",
				shouldCommit: true,
				timeoutSeconds: 900,
				modelSettings: expect.objectContaining({
					temperature: 0.2,
					top_p: 0.9,
					max_tokens: 4096,
					reasoning_effort: "high",
					reasoning: {
						effort: "high",
					},
					verbosity: "low",
				}),
			}),
		});
		expect(emitToolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "sandbox_event",
				status: "run_queued",
			}),
		);
		expect(emitToolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "sandbox_plan",
				data: expect.objectContaining({
					responseType: "custom",
					modelContext: false,
				}),
			}),
		);
		expect(result).toMatchObject({
			status: "completed",
			content: "done",
			data: {
				responseType: "custom",
				result: {
					name: "sandbox_result",
					data: {
						runId: "run-123",
						status: "completed",
						summary: "done",
						result: {
							diff: "diff",
							branchName: "sandbox/run-123",
						},
					},
				},
			},
		});
	});

	it("forces read-only sandbox task types to run without commits", async () => {
		await run_code_review.execute(
			{
				task: "Review auth middleware",
				shouldCommit: true,
			},
			createToolContext(),
		);

		expect(vi.mocked(executeSandboxRunStream).mock.calls[0]?.[0].payload).toMatchObject({
			taskType: "code-review",
			shouldCommit: false,
		});

		vi.mocked(executeSandboxRunStream).mockClear();
		await run_test_suite.execute(
			{
				task: "Run API tests",
				shouldCommit: true,
			},
			createToolContext(),
		);

		expect(vi.mocked(executeSandboxRunStream).mock.calls[0]?.[0].payload).toMatchObject({
			taskType: "test-suite",
			shouldCommit: false,
		});
	});

	it("requires a configured GitHub installation", async () => {
		await expect(
			run_feature_implementation.execute(
				{
					repo: "owner/repo",
					task: "Add tests",
				},
				{
					...createToolContext(),
					request: {
						...request,
						request: {
							options: {
								sandbox: {
									repo: "owner/repo",
								},
							},
						} as any,
					},
				},
			),
		).rejects.toThrow("Sandbox GitHub installation is required");
	});
});
