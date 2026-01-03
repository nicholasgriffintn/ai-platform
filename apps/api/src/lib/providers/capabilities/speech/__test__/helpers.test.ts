import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getSpeechProvider,
	listSpeechProviders,
} from "~/lib/providers/capabilities/speech";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		speech: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	speech: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("speech capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.speech", () => {
		const fakeProvider = { generate: vi.fn() };
		mockProviderLibrary.speech.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getSpeechProvider("workers-ai", context);

		expect(mockProviderLibrary.speech).toHaveBeenCalledWith(
			"workers-ai",
			context,
		);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Workers AI", category: "speech", aliases: ["workers-ai"] },
			{ name: "Replicate", category: "speech", aliases: ["replicate"] },
		]);

		const providers = listSpeechProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("speech");
		expect(providers).toEqual(
			["Replicate", "Workers AI", "replicate", "workers-ai"].sort(),
		);
	});
});
