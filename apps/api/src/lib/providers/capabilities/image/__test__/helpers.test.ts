import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getImageProvider,
	listImageProviders,
} from "~/lib/providers/capabilities/image";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		image: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	image: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("image capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.image", () => {
		const fakeProvider = { generate: vi.fn() };
		mockProviderLibrary.image.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getImageProvider("workers-ai", context);

		expect(mockProviderLibrary.image).toHaveBeenCalledWith(
			"workers-ai",
			context,
		);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Workers AI", category: "image", aliases: ["workers-ai"] },
			{ name: "Replicate", category: "image", aliases: ["replicate"] },
		]);

		const providers = listImageProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("image");
		expect(providers).toEqual(
			["Replicate", "Workers AI", "replicate", "workers-ai"].sort(),
		);
	});
});
