import { describe, expect, it } from "vitest";

import { parseAgentDecision } from "../feature-implementation/decision";

describe("parseAgentDecision", () => {
	it("accepts supported run_script languages", () => {
		const decision = parseAgentDecision(
			JSON.stringify({
				action: "run_script",
				code: "print('ok')",
				language: "javascript",
			}),
		);

		expect(decision.action).toBe("run_script");
		if (decision.action === "run_script") {
			expect(decision.language).toBe("javascript");
		}
	});

	it("rejects unsupported run_script languages", () => {
		expect(() =>
			parseAgentDecision(
				JSON.stringify({
					action: "run_script",
					code: "console.log('ok')",
					language: "bash",
				}),
			),
		).toThrow(/Invalid agent decision/);
	});

	it("accepts JSON payloads with raw newlines in string values", () => {
		const decision =
			parseAgentDecision(`{"action":"run_script","language":"javascript","code":"import fs from 'fs';

const value = 1;
console.log(value);","reasoning":"edit file"}`);

		expect(decision.action).toBe("run_script");
		if (decision.action === "run_script") {
			expect(decision.language).toBe("javascript");
			expect(decision.code).toContain("const value = 1;");
		}
	});

	it("parses update_plan payload wrapped in surrounding prose", () => {
		const decision = parseAgentDecision(
			`I updated the plan:

{"action":"update_plan","plan":"### Updated Implementation Plan for SW-101

#### 1. Update \`src/worklog.js\`
- Modify listOpenWorkItems to accept an optional assignee.
- Keep backward compatibility.","reasoning":"Need to refine implementation steps."}

Proceeding next.`,
		);

		expect(decision.action).toBe("update_plan");
		if (decision.action === "update_plan") {
			expect(decision.plan).toContain("Updated Implementation Plan for SW-101");
		}
	});

	it("parses action JSON when multiple brace sections exist", () => {
		const decision = parseAgentDecision(
			`Context: {not valid json}
{"action":"finish","summary":"Done","reasoning":"All checks passed"}`,
		);

		expect(decision.action).toBe("finish");
	});

	it("infers action from fields when action is missing", () => {
		const decision = parseAgentDecision(
			JSON.stringify({
				command: "pnpm -r test --filter sandbox-worker",
				reasoning: "run tests",
			}),
		);

		expect(decision.action).toBe("run_command");
		if (decision.action === "run_command") {
			expect(decision.command).toContain("pnpm -r test");
		}
	});

	it("parses run_parallel command arrays", () => {
		const decision = parseAgentDecision(
			JSON.stringify({
				action: "run_parallel",
				commands: ["git status", "rg --files"],
			}),
		);

		expect(decision.action).toBe("run_parallel");
		if (decision.action === "run_parallel") {
			expect(decision.commands).toHaveLength(2);
		}
	});
});
