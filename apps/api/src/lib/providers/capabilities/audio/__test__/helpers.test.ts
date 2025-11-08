import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getAudioProvider,
	listAudioProviders,
} from "~/lib/providers/capabilities/audio";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		audio: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	audio: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("audio capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.audio", () => {
		const fakeProvider = { synthesize: vi.fn() };
		mockProviderLibrary.audio.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getAudioProvider("polly", context);

		expect(mockProviderLibrary.audio).toHaveBeenCalledWith("polly", context);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Cartesia", category: "audio", aliases: ["cartesia-tts"] },
			{ name: "Polly", category: "audio", aliases: ["aws-polly", "polly"] },
		]);

		const providers = listAudioProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("audio");
		expect(providers).toEqual(
			["Cartesia", "Polly", "aws-polly", "cartesia-tts", "polly"].sort(),
		);
	});
});
