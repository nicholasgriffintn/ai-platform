import { describe, expect, it } from "vitest";

import type { IBody, IUserSettings } from "~/types";
import { returnCodingPrompt } from "../coding";

describe("returnCodingPrompt", () => {
	describe("basic functionality", () => {
		it("should generate prompt with minimal parameters", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should include coding-specific assistant info", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("experienced software developer");
			expect(result).toContain("coding questions or generating code");
		});
	});

	describe("parameter handling", () => {
		it("should use default mode when not provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("assistant_info");
		});

		it("should handle agent mode", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { mode: "agent" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("experienced software developer");
		});

		it("should handle standard mode explicitly", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { mode: "standard" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("experienced software developer");
		});

		it("should use default verbosity when not provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
		});

		it("should handle different verbosity levels", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { verbosity: "low" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
			expect(result).toContain("Favor brevity");
		});
	});

	describe("user context handling", () => {
		it("should include user nickname when provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = { nickname: "CodingBot" };
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<user_nickname>CodingBot</user_nickname>");
		});

		it("should include user job role when provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = { job_role: "Senior Developer" };
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain(
				"<user_job_role>Senior Developer</user_job_role>",
			);
		});

		it("should handle null user settings", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request, undefined);
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should handle empty user settings", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = {};
			const result = returnCodingPrompt(request, userSettings);
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should include preferred language when provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { lang: "de" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("<preferred_language>de</preferred_language>");
			expect(result).toContain("Default to replying in de");
		});

		it("should include safety standards section", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<safety_standards>");
			expect(result).toContain(
				"high-risk advice (medical, legal, financial, mental health)",
			);
		});

		it("should include instruction precedence block", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<instruction_precedence>");
			expect(result).toContain(
				"<order>system > safety_standards > assistant_principles > response_preferences > example_output</order>",
			);
		});
	});

	describe("feature flags handling", () => {
		it("should include thinking section when supportsReasoning is false", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(
				request,
				undefined,
				false,
				false,
				false,
			);
			expect(result).toContain("<think>");
		});

		it("should skip thinking section when supportsReasoning is true", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request, undefined, false, false, true);
			expect(result).not.toContain("<think>");
		});

		it("should include artifact example when supportsArtifacts is true", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request, undefined, false, true, false);
			expect(result).toContain("artifact");
			expect(result).toContain("<artifact_example>");
			expect(result).toContain("<validation>");
			expect(result).toContain("<next_steps>");
		});

		it("should include solution section when supportsArtifacts is false", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(
				request,
				undefined,
				false,
				false,
				false,
			);
			expect(result).toContain("<solution>");
			expect(result).toContain("<code_block");
			expect(result).toContain("<reference_note>");
			expect(result).toContain("<validation>");
			expect(result).toContain("<next_steps>");
		});

		it("should handle supportsToolCalls flag", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request, undefined, true, false, false);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
		});

		it("should handle requiresThinkingPrompt flag", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(
				request,
				undefined,
				false,
				false,
				false,
				true,
			);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
		});

		it("should derive supportsArtifacts from model metadata when not provided", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(
				request,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{
					modelConfig: {
						supportsArtifacts: true,
					} as any,
				},
			);
			expect(result).toContain("artifact");
		});
	});

	describe("memories handling", () => {
		it("should detect memories enabled from save setting", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = { memories_save_enabled: true };
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<response_traits>");
		});

		it("should detect memories enabled from chat history setting", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = {
				memories_chat_history_enabled: true,
			};
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<response_traits>");
		});

		it("should handle memories disabled", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = {
				memories_save_enabled: false,
				memories_chat_history_enabled: false,
			};
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<response_traits>");
		});
	});

	describe("user traits and preferences", () => {
		it("should pass user traits to response style", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = { traits: "detailed and methodical" };
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<response_traits>");
		});

		it("should pass user preferences to response style", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = {
				preferences: "prefer TypeScript examples",
			};
			const result = returnCodingPrompt(request, userSettings);
			expect(result).toContain("<response_preferences>");
		});
	});

	describe("template structure", () => {
		it("should have proper XML structure", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<assistant_info>");
			expect(result).toContain("</assistant_info>");
			expect(result).toContain("<user_context>");
			expect(result).toContain("</user_context>");
			expect(result).toContain("<response_traits>");
			expect(result).toContain("</response_traits>");
			expect(result).toContain("<response_preferences>");
			expect(result).toContain("</response_preferences>");
		});

		it("should include example output structure", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<example_output>");
			expect(result).toContain("<answer>");
			expect(result).toContain("</answer>");
			expect(result).toContain("</example_output>");
		});

		it("should include coding-specific sections", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain("<introduction>");
			expect(result).toContain("<implementation_explanation>");
			expect(result).toContain("<additional_info>");
		});

		it("should include programming language guidance", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request);
			expect(result).toContain(
				"tailor your response to the specified programming language",
			);
			expect(result).toContain("accuracy and professionalism");
		});
	});

	describe("verbosity variations", () => {
		it("should handle low verbosity appropriately", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { verbosity: "low" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
			expect(result).toContain("<tone_hint>");
		});

		it("should handle high verbosity appropriately", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { verbosity: "high" };
			const result = returnCodingPrompt(request);
			expect(result).toContain("<response_traits>");
			expect(result).toContain("<response_preferences>");
			expect(result).toContain("<tone_hint>");
		});
	});

	describe("artifact handling", () => {
		it("should prefer artifact over solution when artifacts supported", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(request, undefined, false, true, false);
			expect(result).not.toContain("<solution>");
			expect(result).toContain("artifact");
		});

		it("should use solution when artifacts not supported", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = {};
			const result = returnCodingPrompt(
				request,
				undefined,
				false,
				false,
				false,
			);
			expect(result).toContain("<solution>");
		});
	});

	describe("output consistency", () => {
		it("should produce consistent output for same inputs", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { mode: "standard", verbosity: "medium" };
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = { nickname: "test" };
			const result1 = returnCodingPrompt(request, userSettings);
			const result2 = returnCodingPrompt(request, userSettings);
			expect(result1).toBe(result2);
		});

		it("should handle complex user settings combinations", () => {
			// @ts-expect-error - mock implementation
			const request: IBody = { verbosity: "high" };
			// @ts-expect-error - mock implementation
			const userSettings: IUserSettings = {
				nickname: "CodeMaster",
				job_role: "Full Stack Developer",
				traits: "thorough and precise",
				preferences: "prefer functional programming",
				memories_save_enabled: true,
				memories_chat_history_enabled: false,
			};
			const result = returnCodingPrompt(
				request,
				userSettings,
				true,
				true,
				false,
				true,
			);
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
			expect(result).toContain("CodeMaster");
			expect(result).toContain("Full Stack Developer");
		});
	});

	describe("agent mode differences", () => {
		it("should pass isAgent flag correctly to getResponseStyle", () => {
			// @ts-expect-error - mock implementation
			const agentRequest: IBody = { mode: "agent" };
			// @ts-expect-error - mock implementation
			const standardRequest: IBody = { mode: "standard" };

			const agentResult = returnCodingPrompt(agentRequest);
			const standardResult = returnCodingPrompt(standardRequest);

			expect(agentResult).toContain("<response_traits>");
			expect(standardResult).toContain("<response_traits>");
		});
	});
});
