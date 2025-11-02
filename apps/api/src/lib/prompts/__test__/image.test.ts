import { describe, expect, it } from "vitest";
import { getTextToImageSystemPrompt, imagePrompts } from "../image";

describe("image prompts", () => {
	describe("imagePrompts object", () => {
		it("should contain all expected style keys", () => {
			const expectedStyles = [
				"default",
				"art-deco",
				"cinematic",
				"cyberpunk",
				"fantasy",
				"graffiti",
				"impressionist",
				"minimal",
				"moody",
				"noir",
				"pop-art",
				"retro",
				"surreal",
				"vaporwave",
				"vibrant",
				"watercolor",
			];

			expectedStyles.forEach((style) => {
				expect(imagePrompts).toHaveProperty(style);
				expect(imagePrompts[style]).toHaveProperty("prompt");
				expect(typeof imagePrompts[style].prompt).toBe("string");
				expect(imagePrompts[style].prompt.length).toBeGreaterThan(0);
			});
		});

		it("should have all prompts end with 'Based on the user's prompt: '", () => {
			Object.values(imagePrompts).forEach((styleData) => {
				expect(styleData.prompt).toMatch(/Based on the user's prompt: $/);
			});
		});

		it("should have unique prompt content for each style", () => {
			const prompts = Object.values(imagePrompts).map((style) => style.prompt);
			const uniquePrompts = new Set(prompts);
			expect(uniquePrompts.size).toBe(prompts.length);
		});
	});

	describe("getTextToImageSystemPrompt", () => {
		it("should return default prompt for valid default style", () => {
			const result = getTextToImageSystemPrompt("default");
			expect(result).toBe(imagePrompts.default.prompt);
			expect(result).toContain(
				"Create a high-quality image that is a realistic representation",
			);
		});

		it("should return correct prompt for specific valid styles", () => {
			const result = getTextToImageSystemPrompt("cyberpunk");
			expect(result).toBe(imagePrompts.cyberpunk.prompt);
			expect(result).toContain("high-tech dystopian cityscape");
			expect(result).toContain("neon lighting");
		});

		it("should return art-deco prompt correctly", () => {
			const result = getTextToImageSystemPrompt("art-deco");
			expect(result).toBe(imagePrompts["art-deco"].prompt);
			expect(result).toContain("1920s-30s Art Deco style");
			expect(result).toContain("geometric patterns");
		});

		it("should return pop-art prompt correctly", () => {
			const result = getTextToImageSystemPrompt("pop-art");
			expect(result).toBe(imagePrompts["pop-art"].prompt);
			expect(result).toContain("Roy Lichtenstein and Andy Warhol");
			expect(result).toContain("Ben-Day dots");
		});

		it("should fallback to default for invalid style", () => {
			const result = getTextToImageSystemPrompt("nonexistent" as any);
			expect(result).toBe(imagePrompts.default.prompt);
		});

		it("should fallback to default for undefined style", () => {
			const result = getTextToImageSystemPrompt(undefined as any);
			expect(result).toBe(imagePrompts.default.prompt);
		});

		it("should handle all defined styles without error", () => {
			const styleKeys = Object.keys(imagePrompts) as Array<
				keyof typeof imagePrompts
			>;

			styleKeys.forEach((style) => {
				expect(() => getTextToImageSystemPrompt(style)).not.toThrow();
				const result = getTextToImageSystemPrompt(style);
				expect(typeof result).toBe("string");
				expect(result.length).toBeGreaterThan(0);
			});
		});
	});

	describe("style-specific content validation", () => {
		it("should contain style-appropriate keywords for cinematic", () => {
			const result = getTextToImageSystemPrompt("cinematic");
			expect(result).toContain("widescreen");
			expect(result).toContain("cinematography");
			expect(result).toContain("depth of field");
		});

		it("should contain style-appropriate keywords for minimal", () => {
			const result = getTextToImageSystemPrompt("minimal");
			expect(result).toContain("clean");
			expect(result).toContain("minimalist");
			expect(result).toContain("negative space");
		});

		it("should contain style-appropriate keywords for watercolor", () => {
			const result = getTextToImageSystemPrompt("watercolor");
			expect(result).toContain("translucent");
			expect(result).toContain("paper texture");
			expect(result).toContain("brush strokes");
		});

		it("should contain style-appropriate keywords for noir", () => {
			const result = getTextToImageSystemPrompt("noir");
			expect(result).toContain("black and white");
			expect(result).toContain("dramatic shadows");
			expect(result).toContain("1940s detective");
		});
	});
});
