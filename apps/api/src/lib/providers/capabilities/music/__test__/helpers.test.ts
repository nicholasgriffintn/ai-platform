import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getMusicProvider,
	listMusicProviders,
} from "~/lib/providers/capabilities/music";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		music: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	music: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("music capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.music", () => {
		const fakeProvider = { generate: vi.fn() };
		mockProviderLibrary.music.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getMusicProvider("replicate", context);

		expect(mockProviderLibrary.music).toHaveBeenCalledWith(
			"replicate",
			context,
		);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "ElevenLabs", category: "music", aliases: ["elevenlabs"] },
			{ name: "Replicate", category: "music", aliases: ["replicate"] },
		]);

		const providers = listMusicProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("music");
		expect(providers).toEqual(
			["ElevenLabs", "Replicate", "elevenlabs", "replicate"].sort(),
		);
	});
});
