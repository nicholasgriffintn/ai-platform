import { describe, expect, it } from "vitest";
import { emptyPrompt, getResponseStyle } from "../utils";

describe("prompts utils", () => {
	describe("getResponseStyle", () => {
		describe("default parameter handling", () => {
			it("should return object with required properties", () => {
				const result = getResponseStyle();
				expect(result).toHaveProperty("traits");
				expect(result).toHaveProperty("preferences");
				expect(result).toHaveProperty("problemBreakdownInstructions");
				expect(result).toHaveProperty("answerFormatInstructions");
				expect(typeof result.traits).toBe("string");
				expect(typeof result.preferences).toBe("string");
				expect(typeof result.problemBreakdownInstructions).toBe("string");
				expect(typeof result.answerFormatInstructions).toBe("string");
			});

			it("should use default traits when no user traits provided", () => {
				const result = getResponseStyle();
				expect(result.traits).toContain("direct, intellectually curious");
				expect(result.traits).toContain("balanced in verbosity");
			});

			it("should use custom user traits when provided", () => {
				const customTraits = "custom trait set";
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					customTraits,
				);
				expect(result.traits).toBe(customTraits);
			});

			it("should use custom user preferences when provided", () => {
				const customPreferences = "custom preferences";
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					undefined,
					customPreferences,
				);
				expect(result.preferences).toContain(customPreferences);
			});
		});

		describe("verbosity handling", () => {
			it("should handle low verbosity", () => {
				const result = getResponseStyle("low");
				expect(result.problemBreakdownInstructions).toContain("brief");
				expect(result.problemBreakdownInstructions).toContain(
					"critical aspects",
				);
				expect(result.answerFormatInstructions).toContain(
					"minimal explanation",
				);
			});

			it("should handle high verbosity", () => {
				const result = getResponseStyle("high");
				expect(result.problemBreakdownInstructions).toContain("thorough");
				expect(result.problemBreakdownInstructions).toContain(
					"detailed explanations",
				);
				expect(result.answerFormatInstructions).toContain("detail");
			});

			it("should handle medium/default verbosity", () => {
				const result = getResponseStyle("medium");
				expect(result.problemBreakdownInstructions).toContain("balanced");
				expect(result.answerFormatInstructions).toContain(
					"Balance your answer with explanation, providing enough context to understand the solution without overwhelming detail.",
				);
				expect(result.preferences).toContain(
					"Include 'Key steps' for complex tasks.",
				);
			});

			it("should fallback to medium for invalid verbosity", () => {
				const normalResult = getResponseStyle("medium");
				const invalidResult = getResponseStyle("invalid" as any);
				expect(invalidResult.problemBreakdownInstructions).toBe(
					normalResult.problemBreakdownInstructions,
				);
				expect(invalidResult.answerFormatInstructions).toBe(
					normalResult.answerFormatInstructions,
				);
			});
		});

		describe("agent mode handling", () => {
			it("should return simplified structure for agent mode", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					true,
				);
				expect(result.preferences).not.toContain(
					"Please also follow these instructions",
				);
				expect(result.problemBreakdownInstructions).toContain(
					"Outline the key steps in your plan so the user understands how you will proceed before executing.",
				);
				expect(result.answerFormatInstructions).toContain(
					"Deliver the answer with a concise summary of outcomes and recommended next actions.",
				);
			});

			it("should not include step-by-step instructions for agent mode", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					true,
				);
				expect(result.preferences).not.toMatch(/\d+\./);
			});
		});

		describe("coding mode adjustments", () => {
			it("should include coding-specific instructions when isCoding is true", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					undefined,
					undefined,
					true,
				);
				expect(result.preferences).toContain(
					"When coding, present runnable code in fenced blocks or artifacts and call out assumptions or edge cases.",
				);
				expect(result.preferences).toContain("best practices and conventions");
				expect(result.answerFormatInstructions).toContain("code");
			});

			it("should exclude plain text instruction when isCoding is true", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					undefined,
					undefined,
					true,
				);
				expect(result.preferences).not.toContain(
					"Always respond in plain text, not computer code",
				);
			});

			it("should include plain text instruction when isCoding is false", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					undefined,
					undefined,
					false,
				);
				expect(result.preferences).toContain(
					"Keep chat responses in Markdown prose; add short code snippets only when they clarify the explanation.",
				);
			});
		});

		describe("function support adjustments", () => {
			it("should include function instructions when supportsToolCalls is true", () => {
				const result = getResponseStyle("medium", false, false, true);
				expect(result.preferences).toContain(
					"Prefer the lightest option (internal knowledge → retrieval → browsing → code execution)",
				);
				expect(result.preferences).toContain(
					"include a short outcome summary only if it helps the user",
				);
			});

			it("should not include function instructions when supportsToolCalls is false", () => {
				const result = getResponseStyle("medium", false, false, false);
				expect(result.preferences).not.toContain("tool is required");
			});
		});

		describe("thinking mode adjustments", () => {
			it("should include thinking instructions when supportsReasoning is false or requiresThinkingPrompt is true", () => {
				const result = getResponseStyle("medium", false, false);
				expect(result.preferences).toContain(
					"Analyse the question and context thoroughly before answering, and outline the essential steps you will take.",
				);
				expect(result.preferences).toContain(
					"Include 'Key steps' for complex tasks.",
				);
			});

			it("should not include thinking instructions when supportsReasoning is true and requiresThinkingPrompt is false", () => {
				const result = getResponseStyle("medium", true, false);
				expect(result.preferences).not.toContain(
					"Analyze the question and context thoroughly before answering",
				);
			});
		});

		describe("memories feature handling", () => {
			it("should include memories instructions when enabled", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					true,
				);
				expect(result.preferences).toContain(
					"Only store memories after explicit user consent",
				);
				expect(result.preferences).toContain(
					"Never retain passwords, credentials, financial IDs, or medical details.",
				);
			});

			it("should include disabled message when memories are disabled", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
				);
				expect(result.preferences).toContain(
					"memories are disabled and suggest they capture the detail another way",
				);
			});
		});

		describe("compact instruction variant", () => {
			it("should return condensed preferences when instructionVariant is compact", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					false,
					false,
					false,
					false,
					undefined,
					undefined,
					false,
					"compact",
				);

				expect(result.preferences).toContain(
					"Provide clear, direct answers without filler",
				);
				expect(result.preferences).not.toContain(
					"Please also follow these instructions",
				);
				expect(result.problemBreakdownInstructions).toContain(
					"Sketch the steps",
				);
			});

			it("should include agent-specific compact guidance", () => {
				const result = getResponseStyle(
					"medium",
					false,
					false,
					true,
					true,
					true,
					true,
					undefined,
					undefined,
					true,
					"compact",
				);

				expect(result.preferences).toContain(
					"Only narrate tool usage when it helps the user act on the result.",
				);
				expect(result.preferences).toContain(
					"Ask before storing long-term memories and refuse to keep sensitive personal data.",
				);
				expect(result.problemBreakdownInstructions).toContain(
					"Sketch the steps",
				);
			});
		});
	});

	describe("emptyPrompt", () => {
		it("should return empty string", () => {
			const result = emptyPrompt();
			expect(result).toBe("");
			expect(typeof result).toBe("string");
		});
	});
});
