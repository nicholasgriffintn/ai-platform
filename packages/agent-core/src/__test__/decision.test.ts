import { describe, expect, it } from "vitest";
import { parseAgentDecision } from "../decision";

describe("parseAgentDecision", () => {
	it("parses decision JSON from a code block", () => {
		const decision = parseAgentDecision(
			[
				"I will run this command:",
				"```json",
				'{"action":"run_command","command":"pnpm typecheck"}',
				"```",
			].join("\n"),
		);

		expect(decision).toEqual({
			action: "run_command",
			command: "pnpm typecheck",
			reasoning: undefined,
		});
	});

	it("parses decision JSON embedded in prose", () => {
		const decision = parseAgentDecision(
			'Next step: {"action":"finish","summary":"All checks passed."}',
		);

		expect(decision).toEqual({
			action: "finish",
			summary: "All checks passed.",
			reasoning: undefined,
		});
	});

	it("repairs malformed JSON control characters inside strings", () => {
		const decision = parseAgentDecision(
			'{"action":"run_script","language":"typescript","code":"const one = 1;\nconst two = one + 1;"}',
		);

		expect(decision).toEqual({
			action: "run_script",
			language: "typescript",
			code: "const one = 1;\nconst two = one + 1;",
			reasoning: undefined,
		});
	});

	it("resolves action aliases to canonical actions", () => {
		const decision = parseAgentDecision(
			'{"action":"execute_command","command":"git status"}',
		);

		expect(decision).toEqual({
			action: "run_command",
			command: "git status",
			reasoning: undefined,
		});
	});

	it("falls back to command extraction when no JSON action exists", () => {
		const decision = parseAgentDecision(
			["I could run this:", "```bash", "pnpm lint", "```"].join("\n"),
		);

		expect(decision).toEqual({
			action: "run_command",
			command: "pnpm lint",
			reasoning: "Fallback command extraction from model response",
		});
	});
});
