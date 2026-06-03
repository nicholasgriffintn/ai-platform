import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCanvasOutputs } from "./canvas";

const mocks = vi.hoisted(() => ({
	fetchApi: vi.fn(),
	getHeaders: vi.fn(),
}));

vi.mock("./api-service", () => ({
	apiService: {
		getHeaders: mocks.getHeaders,
	},
}));

vi.mock("./fetch-wrapper", () => ({
	fetchApi: mocks.fetchApi,
	returnFetchedData: (response: Response) => response.json(),
}));

describe("canvas api", () => {
	beforeEach(() => {
		mocks.fetchApi.mockReset();
		mocks.getHeaders.mockReset();
		mocks.getHeaders.mockResolvedValue({ Authorization: "Bearer token" });
	});

	it("does not apply the short default fetch timeout to generation requests", async () => {
		mocks.fetchApi.mockResolvedValue(
			Response.json({
				generations: [],
			}),
		);

		await generateCanvasOutputs({
			mode: "image",
			prompt: "generate a mountain",
			modelIds: ["gpt-image-2"],
		});

		expect(mocks.fetchApi).toHaveBeenCalledWith(
			"/apps/canvas/generate",
			expect.objectContaining({
				timeoutMs: null,
			}),
		);
	});
});
