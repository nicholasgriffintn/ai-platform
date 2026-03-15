import { describe, expect, it } from "vitest";

import { parseAgentDecision } from "../feature-implementation/decision";

describe("parseAgentDecision", () => {
	it("accepts supported run_script languages", () => {
		const decision = parseAgentDecision(
			JSON.stringify({
				action: "run_script",
				code: "print('ok')",
				language: "python",
			}),
		);

		expect(decision.action).toBe("run_script");
		if (decision.action === "run_script") {
			expect(decision.language).toBe("python");
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
});
