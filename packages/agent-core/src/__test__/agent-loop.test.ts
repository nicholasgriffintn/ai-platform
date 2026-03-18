import { describe, expect, it, vi } from "vitest";
import { executeAgentLoop } from "../agent-loop";
import type {
	ActionHandler,
	AgentDecision,
	AgentDecisionContext,
} from "../types";

function createRunCommandHandler(
	onExecute?: (context: {
		step: number;
		beginPlanRecovery: (reason: string) => void;
	}) => void,
): ActionHandler {
	return {
		name: "run_command",
		canHandle: (
			decision,
		): decision is Extract<AgentDecision, { action: "run_command" }> =>
			decision.action === "run_command",
		execute: async (_decision, context) => {
			onExecute?.({
				step: context.step,
				beginPlanRecovery: context.beginPlanRecovery,
			});
		},
	};
}

describe("executeAgentLoop", () => {
	it("exits immediately when the model returns finish", async () => {
		const result = await executeAgentLoop({
			initialMessages: [{ role: "user", content: "start" }],
			initialPlan: "Complete the task",
			shared: {},
			state: { commandCount: 0 },
			resolveDecision: async () => ({
				decision: { action: "finish", summary: "Completed." },
			}),
			handlers: [],
		});

		expect(result).toEqual({
			summary: "Completed.",
			finalPlan: "Complete the task",
			commandCount: 0,
			stepsTaken: 1,
		});
	});

	it("triggers recovery flow after consecutive decision failures", async () => {
		const onPlanRecovery = vi.fn();
		let attempts = 0;

		const result = await executeAgentLoop({
			initialMessages: [{ role: "user", content: "start" }],
			initialPlan: "Initial plan",
			shared: {},
			state: { commandCount: 0 },
			config: {
				maxSteps: 6,
				maxConsecutiveDecisionFailures: 2,
				maxRecoveryReplans: 2,
			},
			onPlanRecovery,
			resolveDecision: async ({ requiresPlanRecovery }) => {
				attempts += 1;
				if (attempts <= 2) {
					throw new Error("Malformed decision");
				}
				if (requiresPlanRecovery) {
					return {
						decision: {
							action: "update_plan",
							plan: "Recovered plan with safer steps",
						},
					};
				}
				return {
					decision: { action: "finish", summary: "Recovered and finished." },
				};
			},
			handlers: [createRunCommandHandler()],
		});

		expect(onPlanRecovery).toHaveBeenCalledTimes(1);
		expect(result.summary).toBe("Recovered and finished.");
		expect(result.stepsTaken).toBe(4);
	});

	it("enforces maxSteps and throws when the loop cannot finish", async () => {
		await expect(
			executeAgentLoop({
				initialMessages: [{ role: "user", content: "start" }],
				initialPlan: "Initial plan",
				shared: {},
				state: { commandCount: 0 },
				config: {
					maxSteps: 2,
				},
				resolveDecision: async () => ({
					decision: { action: "run_command", command: "echo still-running" },
				}),
				handlers: [createRunCommandHandler()],
			}),
		).rejects.toThrow("Agent exceeded maximum step budget (2)");
	});

	it("extends step budget when continuation is requested", async () => {
		let attempts = 0;
		const result = await executeAgentLoop({
			initialMessages: [{ role: "user", content: "start" }],
			initialPlan: "Initial plan",
			shared: {},
			state: { commandCount: 0 },
			config: {
				maxSteps: 2,
				maxStepExtensions: 1,
			},
			onStepBudgetExceeded: () => ({
				extendBy: 2,
				reason: "continue requested",
			}),
			resolveDecision: async () => {
				attempts += 1;
				if (attempts < 4) {
					return {
						decision: { action: "run_command", command: "echo progress" },
					};
				}
				return {
					decision: { action: "finish", summary: "done after extension" },
				};
			},
			handlers: [createRunCommandHandler()],
		});

		expect(result.summary).toBe("done after extension");
		expect(result.stepsTaken).toBe(4);
	});

	it("requires update_plan on the step after beginPlanRecovery", async () => {
		const contexts: AgentDecisionContext[] = [];
		let callCount = 0;

		const result = await executeAgentLoop({
			initialMessages: [{ role: "user", content: "start" }],
			initialPlan: "Initial plan",
			shared: {},
			state: { commandCount: 0 },
			config: {
				maxSteps: 6,
				maxRecoveryReplans: 2,
			},
			resolveDecision: async (context) => {
				contexts.push({
					...context,
					messages: [...context.messages],
				});
				callCount += 1;

				if (callCount === 1) {
					return {
						decision: { action: "run_command", command: "echo first" },
					};
				}
				if (callCount === 2) {
					return {
						decision: { action: "run_command", command: "echo blocked" },
					};
				}
				if (callCount === 3) {
					return {
						decision: { action: "update_plan", plan: "Safer revised plan" },
					};
				}
				return {
					decision: { action: "finish", summary: "Done after recovery." },
				};
			},
			handlers: [
				createRunCommandHandler(({ step, beginPlanRecovery }) => {
					if (step === 1) {
						beginPlanRecovery("Tool execution failed");
					}
				}),
			],
		});

		expect(contexts[1]?.requiresPlanRecovery).toBe(true);
		expect(result.summary).toBe("Done after recovery.");
		expect(result.stepsTaken).toBe(4);
	});
});
