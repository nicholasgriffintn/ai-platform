import { describe, expect, it } from "vitest";

import { openaiModelConfig } from "../openai";

describe("openaiModelConfig", () => {
	it("only enables OpenAI tool search on supported GPT-5.4+ models", () => {
		expect(openaiModelConfig["gpt-5.3-codex"]?.supportsToolSearch).toBeUndefined();
		expect(openaiModelConfig["gpt-5.4"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-mini"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-nano"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.5"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.5-pro"]?.supportsToolSearch).toBe(true);
	});

	it("only exposes tools the app can execute without a custom action loop", () => {
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsCodeExecution).toBe(false);
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsHostedShell).toBeUndefined();
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsToolSearch).toBe(true);
	});
});
