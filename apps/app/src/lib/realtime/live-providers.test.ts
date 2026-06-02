import { describe, expect, it } from "vitest";

import { REALTIME_LIVE_PROVIDER_MANIFEST } from "@assistant/schemas";
import {
	getDefaultLiveModelId,
	getRealtimeLiveProviderIdForModel,
	isRealtimeLiveProviderId,
	supportsRealtimeLiveVideoInput,
} from "./live-providers";

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

	it("uses the shared provider manifest for default models and video support", () => {
		for (const provider of REALTIME_LIVE_PROVIDER_MANIFEST) {
			expect(getDefaultLiveModelId(provider.id)).toBe(provider.defaultModelId);
		}

		expect(supportsRealtimeLiveVideoInput("google-ai-studio")).toBe(true);
		expect(supportsRealtimeLiveVideoInput("mistral")).toBe(false);
	});
});
