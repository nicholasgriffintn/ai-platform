import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getResearchProvider,
	listResearchProviders,
} from "~/lib/providers/capabilities/research";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		research: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	research: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("research capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("resolves providers via providerLibrary.research", () => {
		const fakeProvider = { performResearch: vi.fn() };
		mockProviderLibrary.research.mockReturnValue(fakeProvider as any);

		const context = { env: { DB: {} } as any, user: { id: 42 } as any };
		const provider = getResearchProvider("parallel", context);

		expect(mockProviderLibrary.research).toHaveBeenCalledWith(
			"parallel",
			context,
		);
		expect(provider).toBe(fakeProvider);
	});

	it("lists providers with alias support", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Exa", category: "research", aliases: ["exa-research"] },
			{
				name: "Parallel",
				category: "research",
				aliases: ["parallel-research"],
			},
		]);

		const providers = listResearchProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("research");
		expect(providers).toEqual(
			["Exa", "Parallel", "exa-research", "parallel-research"].sort(),
		);
	});
});
