import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRealtimeProvider, listRealtimeProviders } from "~/lib/providers/capabilities/realtime";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		realtime: vi.fn(),
		list: vi.fn(),
	},
}));

let mockProviderLibrary: {
	realtime: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

describe("realtime capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
	});

	it("delegates provider resolution to providerLibrary.realtime", () => {
		const fakeProvider = { createSession: vi.fn() };
		mockProviderLibrary.realtime.mockReturnValue(fakeProvider as any);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getRealtimeProvider("openai", context);

		expect(mockProviderLibrary.realtime).toHaveBeenCalledWith("openai", context);
		expect(provider).toBe(fakeProvider);
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "OpenAI", category: "realtime", aliases: ["gpt", "openai"] },
		]);

		const providers = listRealtimeProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("realtime");
		expect(providers).toEqual(["OpenAI", "gpt", "openai"].sort());
	});
});
