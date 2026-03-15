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
				exec: vi.fn(),
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
});
