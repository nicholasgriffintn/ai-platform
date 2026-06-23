import { describe, expect, it } from "vitest";

import { getModels } from "../index";

describe("getModels", () => {
	it("keeps OpenAI GPT-5.4 catalogue entries alongside reseller providers", () => {
		const models = getModels({
			shouldUseCache: false,
			excludeModalities: [
				"guardrails",
				"voice-activity-detection",
				"reranking",
				"embedding",
				"speech",
			],
		});

		expect(models["gpt-5.4"]?.provider).toBe("openai");
		expect(models["azure-openai/gpt-5.4"]?.provider).toBe("azure-openai");
		expect(models["github-copilot/gpt-5.4"]?.provider).toBe("github-copilot");
		expect(models["openai/gpt-5.4"]?.provider).toBe("openrouter");
		expect(models["vercel/openai/gpt-5.4"]?.provider).toBe("vercel");
	});

	it("keeps realtime transcription models when speech-only models are excluded", () => {
		const models = getModels({
			shouldUseCache: false,
			excludeModalities: [
				"guardrails",
				"voice-activity-detection",
				"reranking",
				"embedding",
				"speech",
			],
		});

		expect(models["voxtral-mini-transcribe-realtime"]).toMatchObject({
			provider: "mistral",
			supportsRealtimeSession: true,
		});
	});

	it("excludes guardrail and safety models from the default catalogue", () => {
		const models = getModels({
			shouldUseCache: false,
			excludeModalities: [
				"guardrails",
				"voice-activity-detection",
				"reranking",
				"embedding",
				"speech",
			],
		});

		expect(Object.keys(models)).not.toEqual(
			expect.arrayContaining([
				"@cf/meta/llama-guard-3-8b",
				"meta-llama/llama-guard-3-8b",
				"meta-llama/llama-guard-4-12b",
				"meta-llama/llama-prompt-guard-2-22m",
				"meta-llama/llama-prompt-guard-2-86m",
				"openai.gpt-oss-safeguard-120b",
				"openai.gpt-oss-safeguard-20b",
				"gpt-oss-safeguard-120b",
				"qwen3guard-gen-8b",
				"qwen3guard-gen-0.6b",
			]),
		);
	});
});
