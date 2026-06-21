import { describe, expect, it } from "vitest";

import {
	buildContinuationInstruction,
	buildInitialPlan,
	getAgentCompletionRequirements,
	shouldRequireToolChoice,
	withRequiredToolChoice,
} from "../completionRequirements";

describe("agent completion requirements", () => {
	it("parses configured completion requirements", () => {
		expect(
			getAgentCompletionRequirements({
				enabled_tools: ["get_weather"],
				tool_choice: "auto",
				options: {
					agent: {
						minToolCalls: 2,
					},
				},
			}),
		).toEqual({
			minToolCalls: 2,
		});
	});

	it("defaults invalid completion requirements", () => {
		expect(
			getAgentCompletionRequirements({
				enabled_tools: [],
				tool_choice: "auto",
				options: {
					agent: {
						minToolCalls: -1,
					},
				},
			}),
		).toEqual({
			minToolCalls: 0,
		});
	});

	it("requires tool choice while minimum tool calls are unmet", () => {
		const requirements = { minToolCalls: 1 };

		expect(
			shouldRequireToolChoice({
				requirements,
				commandCount: 0,
				requestParams: { enabled_tools: ["get_weather"], tool_choice: "auto" },
			}),
		).toBe(true);
		expect(
			shouldRequireToolChoice({
				requirements,
				commandCount: 1,
				requestParams: { enabled_tools: ["get_weather"], tool_choice: "auto" },
			}),
		).toBe(false);
	});

	it("builds completion prompts and required tool-choice requests", () => {
		const requirements = {
			minToolCalls: 1,
		};
		const requestParams = { enabled_tools: ["get_weather"], tool_choice: "auto" as const };

		expect(buildInitialPlan(requirements)).toContain("Do not finish until at least 1 tool call");
		expect(
			buildContinuationInstruction({
				requirements,
				commandCount: 0,
			}),
		).toContain("Complete at least 1 more tool call");
		expect(withRequiredToolChoice(requestParams, true)).toEqual({
			enabled_tools: ["get_weather"],
			tool_choice: "required",
		});
		expect(withRequiredToolChoice(requestParams, false)).toBe(requestParams);
	});
});
