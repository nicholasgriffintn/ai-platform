import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getOcrProvider,
	listOcrProviders,
	resolveOcrProviderName,
} from "~/lib/providers/capabilities/ocr/index";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		ocr: vi.fn(),
		list: vi.fn(),
	},
}));

vi.mock("~/lib/providers/models", () => ({
	resolveModelProvider: vi.fn(),
}));

let mockProviderLibrary: {
	ocr: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

let mockResolveModelProvider: ReturnType<typeof vi.fn>;

describe("ocr capability helpers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const providerLibraryModule = await import("~/lib/providers/library");
		const modelsModule = await import("~/lib/providers/models");
		mockProviderLibrary = vi.mocked(providerLibraryModule.providerLibrary);
		mockResolveModelProvider = vi.mocked(modelsModule.resolveModelProvider);
	});

	it("delegates provider resolution to providerLibrary.ocr", () => {
		const fakeProvider = { extractText: vi.fn() };
		mockProviderLibrary.ocr.mockReturnValue(fakeProvider);

		const context = { env: { TEST: true } as any, user: { id: 1 } as any };
		const provider = getOcrProvider("mistral", context);

		expect(mockProviderLibrary.ocr).toHaveBeenCalledWith("mistral", context);
		expect(provider).toBe(fakeProvider);
	});

	it("resolves OCR provider names from model configuration", async () => {
		mockResolveModelProvider.mockResolvedValue("mistral");

		await expect(
			resolveOcrProviderName({
				env: {} as any,
				model: "mistral-ocr-latest",
			}),
		).resolves.toBe("mistral");

		expect(mockResolveModelProvider).toHaveBeenCalledWith({
			env: {},
			model: "mistral-ocr-latest",
			provider: undefined,
			defaultProvider: "mistral",
		});
	});

	it("returns a sorted, de-duplicated list of provider names", () => {
		mockProviderLibrary.list.mockReturnValue([
			{ name: "Mistral", category: "ocr", aliases: ["mistral"] },
			{ name: "Other", category: "ocr" },
		]);

		const providers = listOcrProviders();

		expect(mockProviderLibrary.list).toHaveBeenCalledWith("ocr");
		expect(providers).toEqual(["Mistral", "Other", "mistral"].sort());
	});
});
