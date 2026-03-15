import { describe, expect, it, vi } from "vitest";

import { executeAgentLoop } from "../feature-implementation/agent-loop";

describe("executeAgentLoop", () => {
	it("continues after a policy-blocked command", async () => {
		const emitted: Array<Record<string, unknown>> = [];
		const chatCompletion = vi
			.fn()
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "run_command",
					command: "pwd && ls -la",
					reasoning: "inspect files",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "finish",
					summary: "done",
					reasoning: "finished",
				}),
			);

		const result = await executeAgentLoop({
			sandbox: {
				exec: vi.fn().mockResolvedValue({
					success: false,
					exitCode: 1,
					stdout: "",
					stderr: "invalid command",
				}),
			} as any,
			client: {
				chatCompletion,
			} as any,
			model: "test-model",
			repoDisplayName: "owner/repo",
			repoTargetDir: "repo",
			task: "test",
			taskType: "feature-implementation",
			promptStrategy: {
				strategy: "feature-delivery",
				definition: {
					strategy: "feature-delivery",
					label: "Feature delivery",
					planningFocus: ["focus"],
					executionFocus: ["focus"],
					examples: [],
				},
				reason: "test",
				source: "explicit",
			},
			initialPlan: "plan",
			repoContext: {
				topLevelEntries: [],
				files: [],
				taskInstructionSource: "none",
			},
			executionLogs: [],
			emit: async (event) => {
				emitted.push(event as unknown as Record<string, unknown>);
			},
		});

		expect(result.summary).toBe("done");
		expect(emitted.some((event) => event.type === "command_failed")).toBe(true);
		expect(chatCompletion).toHaveBeenCalledTimes(2);
	});

	it("recovers from malformed decision responses by requesting replanning", async () => {
		const emitted: Array<Record<string, unknown>> = [];
		const chatCompletion = vi
			.fn()
			.mockResolvedValueOnce("first invalid line\nsecond invalid line")
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "update_plan",
					plan: "1. Inspect target file\n2. Apply focused fix\n3. Verify",
					reasoning: "recovered plan",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "finish",
					summary: "done",
				}),
			);

		const result = await executeAgentLoop({
			sandbox: {
				exec: vi.fn().mockResolvedValue({
					success: false,
					exitCode: 1,
					stdout: "",
					stderr: "invalid command",
				}),
			} as any,
			client: {
				chatCompletion,
			} as any,
			model: "test-model",
			repoDisplayName: "owner/repo",
			repoTargetDir: "repo",
			task: "test",
			taskType: "feature-implementation",
			promptStrategy: {
				strategy: "feature-delivery",
				definition: {
					strategy: "feature-delivery",
					label: "Feature delivery",
					planningFocus: ["focus"],
					executionFocus: ["focus"],
					examples: [],
				},
				reason: "test",
				source: "explicit",
			},
			initialPlan: "plan",
			repoContext: {
				topLevelEntries: [],
				files: [],
				taskInstructionSource: "none",
			},
			executionLogs: [],
			emit: async (event) => {
				emitted.push(event as unknown as Record<string, unknown>);
			},
		});

		expect(result.summary).toBe("done");
		expect(chatCompletion).toHaveBeenCalledTimes(3);
		expect(
			emitted.some((event) => event.type === "agent_decision_invalid"),
		).toBe(true);
		expect(emitted.some((event) => event.type === "plan_updated")).toBe(true);
	});

	it("requires update_plan after repeated command failures instead of hard failing", async () => {
		const emitted: Array<Record<string, unknown>> = [];
		const chatCompletion = vi
			.fn()
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "run_command",
					command: "npm run bad-command",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "run_command",
					command: "npm run bad-command",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "run_command",
					command: "npm run bad-command",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "update_plan",
					plan: "Use a safer inspection-first approach before retrying commands.",
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "finish",
					summary: "recovered",
				}),
			);

		const exec = vi.fn().mockResolvedValue({
			success: false,
			exitCode: 1,
			stdout: "",
			stderr: "command not found",
		});

		const result = await executeAgentLoop({
			sandbox: {
				exec,
			} as any,
			client: {
				chatCompletion,
			} as any,
			model: "test-model",
			repoDisplayName: "owner/repo",
			repoTargetDir: "repo",
			task: "test",
			taskType: "feature-implementation",
			promptStrategy: {
				strategy: "feature-delivery",
				definition: {
					strategy: "feature-delivery",
					label: "Feature delivery",
					planningFocus: ["focus"],
					executionFocus: ["focus"],
					examples: [],
				},
				reason: "test",
				source: "explicit",
			},
			initialPlan: "plan",
			repoContext: {
				topLevelEntries: [],
				files: [],
				taskInstructionSource: "none",
			},
			executionLogs: [],
			emit: async (event) => {
				emitted.push(event as unknown as Record<string, unknown>);
			},
		});

		expect(result.summary).toBe("recovered");
		expect(exec).toHaveBeenCalledTimes(3);
		expect(
			emitted.filter((event) => event.type === "command_failed"),
		).toHaveLength(3);
		expect(emitted.some((event) => event.type === "plan_updated")).toBe(true);
	});

	it("executes safe command batches via run_parallel", async () => {
		const emitted: Array<Record<string, unknown>> = [];
		const chatCompletion = vi
			.fn()
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "run_parallel",
					commands: ["git status --short", "rg --files"],
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "finish",
					summary: "parallel complete",
				}),
			);

		const exec = vi
			.fn()
			.mockResolvedValueOnce({
				success: true,
				exitCode: 0,
				stdout: " M file.ts",
				stderr: "",
			})
			.mockResolvedValueOnce({
				success: true,
				exitCode: 0,
				stdout: "a.ts\nb.ts",
				stderr: "",
			});

		const result = await executeAgentLoop({
			sandbox: {
				exec,
			} as any,
			client: {
				chatCompletion,
			} as any,
			model: "test-model",
			repoDisplayName: "owner/repo",
			repoTargetDir: "repo",
			task: "test",
			taskType: "feature-implementation",
			promptStrategy: {
				strategy: "feature-delivery",
				definition: {
					strategy: "feature-delivery",
					label: "Feature delivery",
					planningFocus: ["focus"],
					executionFocus: ["focus"],
					examples: [],
				},
				reason: "test",
				source: "explicit",
			},
			initialPlan: "plan",
			repoContext: {
				topLevelEntries: [],
				files: [],
				taskInstructionSource: "none",
			},
			executionLogs: [],
			emit: async (event) => {
				emitted.push(event as unknown as Record<string, unknown>);
			},
		});

		expect(result.summary).toBe("parallel complete");
		expect(exec).toHaveBeenCalledTimes(2);
		expect(
			emitted.filter((event) => event.type === "command_completed"),
		).toHaveLength(2);
	});

	it("reads multiple files in one step via read_files", async () => {
		const emitted: Array<Record<string, unknown>> = [];
		const chatCompletion = vi
			.fn()
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "read_files",
					files: [{ path: "src/a.ts" }, { path: "src/b.ts", startLine: 5 }],
				}),
			)
			.mockResolvedValueOnce(
				JSON.stringify({
					action: "finish",
					summary: "read batch complete",
				}),
			);

		const exec = vi
			.fn()
			.mockResolvedValueOnce({
				success: true,
				exitCode: 0,
				stdout: "const a = 1;\n",
				stderr: "",
			})
			.mockResolvedValueOnce({
				success: true,
				exitCode: 0,
				stdout: "const b = 2;\n",
				stderr: "",
			});

		const result = await executeAgentLoop({
			sandbox: {
				exec,
			} as any,
			client: {
				chatCompletion,
			} as any,
			model: "test-model",
			repoDisplayName: "owner/repo",
			repoTargetDir: "repo",
			task: "test",
			taskType: "feature-implementation",
			promptStrategy: {
				strategy: "feature-delivery",
				definition: {
					strategy: "feature-delivery",
					label: "Feature delivery",
					planningFocus: ["focus"],
					executionFocus: ["focus"],
					examples: [],
				},
				reason: "test",
				source: "explicit",
			},
			initialPlan: "plan",
			repoContext: {
				topLevelEntries: [],
				files: [],
				taskInstructionSource: "none",
			},
			executionLogs: [],
			emit: async (event) => {
				emitted.push(event as unknown as Record<string, unknown>);
			},
		});

		expect(result.summary).toBe("read batch complete");
		expect(exec).toHaveBeenCalledTimes(2);
		expect(emitted.filter((event) => event.type === "file_read")).toHaveLength(
			2,
		);
	});
});
