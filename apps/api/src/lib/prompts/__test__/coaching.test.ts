import { describe, expect, it } from "vitest";
import { returnCoachingPrompt } from "../coaching";

describe("returnCoachingPrompt", () => {
	describe("parameter handling", () => {
		it("should generate prompt with required prompt parameter", () => {
			const result = returnCoachingPrompt({ prompt: "test prompt" });
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should use default promptType of general when not provided", () => {
			const result = returnCoachingPrompt({ prompt: "test prompt" });
			expect(result).toContain(
				"Balance clarity, conciseness, and completeness for general purpose prompts",
			);
		});

		it("should use provided promptType", () => {
			const result = returnCoachingPrompt({
				prompt: "test prompt",
				promptType: "technical",
			});
			expect(result).toContain("Emphasize precision, technical accuracy");
		});
	});

	describe("prompt type handling", () => {
		const testPrompt = "test prompt";

		it("should handle creative prompt type", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "creative",
			});
			expect(result).toContain("Focus on enhancing creativity");
			expect(result).toContain("emotional resonance");
			expect(result).toContain("character development");
		});

		it("should handle technical prompt type", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "technical",
			});
			expect(result).toContain("Emphasize precision");
			expect(result).toContain("technical specifications");
			expect(result).toContain("programming language patterns");
		});

		it("should handle instructional prompt type", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "instructional",
			});
			expect(result).toContain("Prioritize clear sequence");
			expect(result).toContain("prerequisites");
			expect(result).toContain("verification steps");
		});

		it("should handle analytical prompt type", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "analytical",
			});
			expect(result).toContain("Focus on logical structure");
			expect(result).toContain("analytical frameworks");
			expect(result).toContain("key metrics");
		});

		it("should handle general prompt type explicitly", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "general",
			});
			expect(result).toContain(
				"Balance clarity, conciseness, and completeness",
			);
		});

		it("should handle invalid prompt type by returning undefined in template", () => {
			const result = returnCoachingPrompt({
				prompt: testPrompt,
				promptType: "invalid" as any,
			});
			expect(result).toContain("undefined");
		});
	});

	describe("template structure", () => {
		const testPrompt = "test prompt";

		it("should include base assistant description", () => {
			const result = returnCoachingPrompt({ prompt: testPrompt });
			expect(result).toContain(
				"You are an AI assistant specialized in helping users create effective prompts",
			);
		});

		it("should include rewrite instruction", () => {
			const result = returnCoachingPrompt({ prompt: testPrompt });
			expect(result).toContain(
				"Rewrite the user's prompt to make it clear, concise, effective",
			);
		});

		it("should include step-by-step instructions", () => {
			const result = returnCoachingPrompt({ prompt: testPrompt });
			expect(result).toContain("1. Begin by identifying the prompt type");
			expect(result).toContain("2. Analyze the initial prompt");
			expect(result).toContain("3. Based on your analysis");
		});

		it("should include XML-style tags for different sections", () => {
			const result = returnCoachingPrompt({ prompt: testPrompt });
			expect(result).toContain("<prompt_type>");
			expect(result).toContain("<prompt_analysis>");
			expect(result).toContain("<revised_prompt>");
			expect(result).toContain("<suggestions>");
			expect(result).toContain("<format_optimization>");
		});

		it("should include analysis requirements", () => {
			const result = returnCoachingPrompt({ prompt: testPrompt });
			expect(result).toContain("Summarize the initial prompt's main goal");
			expect(result).toContain("Identify any unclear or ambiguous parts");
			expect(result).toContain("complexity level (simple, moderate, complex)");
		});

		it("should include the user's prompt in the template", () => {
			const userPrompt = "unique test prompt content 12345";
			const result = returnCoachingPrompt({ prompt: userPrompt });
			expect(result).toContain(userPrompt);
			expect(result).toContain("<prompt_to_improve>");
			expect(result).toContain("</prompt_to_improve>");
		});
	});

	describe("output consistency", () => {
		it("should produce consistent output for same inputs", () => {
			const params = { prompt: "test", promptType: "technical" as const };
			const result1 = returnCoachingPrompt(params);
			const result2 = returnCoachingPrompt(params);
			expect(result1).toBe(result2);
		});

		it("should handle empty prompt", () => {
			const result = returnCoachingPrompt({ prompt: "" });
			expect(typeof result).toBe("string");
			expect(result).toContain("<prompt_to_improve>\n\n</prompt_to_improve>");
		});

		it("should handle special characters in prompt", () => {
			const specialPrompt = "Test with <tags> & \"quotes\" and 'apostrophes'";
			const result = returnCoachingPrompt({ prompt: specialPrompt });
			expect(result).toContain(specialPrompt);
		});
	});
});
