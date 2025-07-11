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
          "normal",
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
          "normal",
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

    describe("response mode handling", () => {
      it("should handle concise mode", () => {
        const result = getResponseStyle("concise");
        expect(result.problemBreakdownInstructions).toContain("brief");
        expect(result.problemBreakdownInstructions).toContain(
          "critical aspects",
        );
        expect(result.answerFormatInstructions).toContain(
          "minimal explanation",
        );
      });

      it("should handle explanatory mode", () => {
        const result = getResponseStyle("explanatory");
        expect(result.problemBreakdownInstructions).toContain("thorough");
        expect(result.problemBreakdownInstructions).toContain(
          "detailed explanations",
        );
        expect(result.answerFormatInstructions).toContain("detail");
      });

      it("should handle formal mode", () => {
        const result = getResponseStyle("formal");
        expect(result.problemBreakdownInstructions).toContain("formal");
        expect(result.problemBreakdownInstructions).toContain(
          "technical terminology",
        );
        expect(result.answerFormatInstructions).toContain("structured manner");
      });

      it("should handle normal/default mode", () => {
        const result = getResponseStyle("normal");
        expect(result.problemBreakdownInstructions).toContain("balanced");
        expect(result.answerFormatInstructions).toContain("Balance");
      });

      it("should fallback to normal for invalid mode", () => {
        const normalResult = getResponseStyle("normal");
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
          "normal",
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
          "balanced problem breakdown",
        );
        expect(result.answerFormatInstructions).toContain("Balance");
      });

      it("should not include step-by-step instructions for agent mode", () => {
        const result = getResponseStyle(
          "normal",
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
          "normal",
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
          "When coding, always use markdown",
        );
        expect(result.preferences).toContain("best practices and conventions");
        expect(result.answerFormatInstructions).toContain("code");
      });

      it("should exclude plain text instruction when isCoding is true", () => {
        const result = getResponseStyle(
          "normal",
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
          "normal",
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
          "Always respond in plain text, not computer code",
        );
      });
    });

    describe("function support adjustments", () => {
      it("should include function instructions when supportsFunctions is true", () => {
        const result = getResponseStyle("normal", false, false, true);
        expect(result.preferences).toContain(
          "Determine whether the query can be resolved directly or if a tool is required",
        );
        expect(result.preferences).toContain("Use the description of the tool");
      });

      it("should not include function instructions when supportsFunctions is false", () => {
        const result = getResponseStyle("normal", false, false, false);
        expect(result.preferences).not.toContain("tool is required");
      });
    });

    describe("thinking mode adjustments", () => {
      it("should include thinking instructions when hasThinking is false or requiresThinkingPrompt is true", () => {
        const result = getResponseStyle("normal", false, false);
        expect(result.preferences).toContain("<think>");
        expect(result.preferences).toContain("thoughts or/and draft");
      });

      it("should not include thinking instructions when hasThinking is true and requiresThinkingPrompt is false", () => {
        const result = getResponseStyle("normal", true, false);
        expect(result.preferences).not.toContain("<think>");
      });
    });

    describe("memories feature handling", () => {
      it("should include memories instructions when enabled", () => {
        const result = getResponseStyle(
          "normal",
          false,
          false,
          false,
          false,
          false,
          true,
        );
        expect(result.preferences).toContain(
          "store long-term conversational memories",
        );
        expect(result.preferences).toContain("recall them when relevant");
      });

      it("should include disabled message when memories are disabled", () => {
        const result = getResponseStyle(
          "normal",
          false,
          false,
          false,
          false,
          false,
          false,
        );
        expect(result.preferences).toContain(
          "memories feature has been disabled",
        );
        expect(result.preferences).toContain(
          "Settings > Customisation > Memories",
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
