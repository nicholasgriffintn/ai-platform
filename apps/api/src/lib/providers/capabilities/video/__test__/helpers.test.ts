import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getVideoProvider,
	listVideoProviders,
} from "~/lib/providers/capabilities/video";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		video: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	video: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("video capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.video", () => {
		const fakeProvider = { generate: vi.fn() };
		mockProviderLibrary.video.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getVideoProvider("replicate", context);

		expect(mockProviderLibrary.video).toHaveBeenCalledWith(
			"replicate",
			context,
		);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Replicate", category: "video", aliases: ["replicate"] },
		]);

		const providers = listVideoProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("video");
		expect(providers).toEqual(["Replicate", "replicate"].sort());
	});
});
