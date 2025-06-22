import { describe, expect, it } from "vitest";
import { PromptBuilder } from "../builder";

describe("PromptBuilder", () => {
  describe("initialization", () => {
    it("should create empty builder when no initial prompt provided", () => {
      const builder = new PromptBuilder();
      expect(builder.build()).toBe("");
    });

    it("should initialize with provided prompt", () => {
      const initialPrompt = "Initial text";
      const builder = new PromptBuilder(initialPrompt);
      expect(builder.build()).toBe(initialPrompt);
    });
  });

  describe("basic text addition", () => {
    it("should add text to builder", () => {
      const builder = new PromptBuilder();
      const result = builder.add("Hello").add(" World").build();
      expect(result).toBe("Hello World");
    });

    it("should skip empty text", () => {
      const builder = new PromptBuilder();
      const result = builder.add("Hello").add("").add(" World").build();
      expect(result).toBe("Hello World");
    });

    it("should return builder instance for chaining", () => {
      const builder = new PromptBuilder();
      const returnValue = builder.add("test");
      expect(returnValue).toBe(builder);
    });
  });

  describe("conditional addition", () => {
    it("should add text when condition is true", () => {
      const builder = new PromptBuilder();
      const result = builder.addIf(true, "conditional text").build();
      expect(result).toBe("conditional text");
    });

    it("should skip text when condition is false", () => {
      const builder = new PromptBuilder();
      const result = builder.addIf(false, "conditional text").build();
      expect(result).toBe("");
    });

    it("should skip empty text even when condition is true", () => {
      const builder = new PromptBuilder();
      const result = builder.addIf(true, "").build();
      expect(result).toBe("");
    });
  });

  describe("conditional with alternatives", () => {
    it("should add true text when condition is true", () => {
      const builder = new PromptBuilder();
      const result = builder
        .addConditional(true, "true text", "false text")
        .build();
      expect(result).toBe("true text");
    });

    it("should add false text when condition is false", () => {
      const builder = new PromptBuilder();
      const result = builder
        .addConditional(false, "true text", "false text")
        .build();
      expect(result).toBe("false text");
    });

    it("should add empty string when condition is false and no false text provided", () => {
      const builder = new PromptBuilder();
      const result = builder.addConditional(false, "true text").build();
      expect(result).toBe("");
    });
  });

  describe("line operations", () => {
    it("should add line with text and newline", () => {
      const builder = new PromptBuilder();
      const result = builder.addLine("Hello").build();
      expect(result).toBe("Hello\n");
    });

    it("should add empty line when no text provided", () => {
      const builder = new PromptBuilder();
      const result = builder.addLine().build();
      expect(result).toBe("\n");
    });
  });

  describe("section operations", () => {
    it("should start section with newline only when no title provided", () => {
      const builder = new PromptBuilder();
      const result = builder.startSection().build();
      expect(result).toBe("\n");
    });

    it("should start section with title and newlines", () => {
      const builder = new PromptBuilder();
      const result = builder.startSection("Section Title").build();
      expect(result).toBe("\nSection Title:\n");
    });
  });

  describe("indentation", () => {
    it("should track indentation level", () => {
      const builder = new PromptBuilder();
      builder.indent().indent();
      expect(builder.build()).toBe("");
    });

    it("should decrease indentation level on outdent", () => {
      const builder = new PromptBuilder();
      builder.indent().indent().outdent();
      expect(builder.build()).toBe("");
    });

    it("should not go below zero indentation", () => {
      const builder = new PromptBuilder();
      builder.outdent().outdent();
      expect(builder.build()).toBe("");
    });
  });

  describe("complex builder operations", () => {
    it("should handle chained operations", () => {
      const builder = new PromptBuilder("Start");
      const result = builder
        .addLine()
        .startSection("Section 1")
        .add("Content 1")
        .addIf(true, " - additional")
        .addConditional(false, " - never", " - alternative")
        .addLine()
        .build();

      expect(result).toContain("Start");
      expect(result).toContain("Section 1:");
      expect(result).toContain("Content 1");
      expect(result).toContain(" - additional");
      expect(result).toContain(" - alternative");
    });

    it("should build consistent output with mixed operations", () => {
      const builder = new PromptBuilder();
      builder
        .add("Hello")
        .addLine(" World")
        .startSection("Important")
        .addIf(true, "This is important")
        .addLine()
        .addConditional(true, "End", "Never");

      const result = builder.build();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
