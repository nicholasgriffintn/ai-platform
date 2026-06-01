import { describe, expect, it } from "vitest";

import { getRealtimeLiveProviderIdForModel, isRealtimeLiveProviderId } from "./live-providers";

describe("live realtime providers", () => {
	it("recognises configured live provider ids", () => {
		expect(isRealtimeLiveProviderId("openai")).toBe(true);
		expect(isRealtimeLiveProviderId("google-ai-studio")).toBe(true);
		expect(isRealtimeLiveProviderId("mistral")).toBe(true);
		expect(isRealtimeLiveProviderId("anthropic")).toBe(false);
	});

	it("derives the live provider from a realtime model", () => {
		expect(
			getRealtimeLiveProviderIdForModel({
				provider: "mistral",
				supportsRealtimeSession: true,
			}),
		).toBe("mistral");

		expect(
			getRealtimeLiveProviderIdForModel({
				provider: "mistral",
				supportsRealtimeSession: false,
			}),
		).toBeUndefined();
	});
});
