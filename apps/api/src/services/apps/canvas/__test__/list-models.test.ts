import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCanvasModels } from "../list-models";
import { listModelsByOutputModality } from "~/services/models";

vi.mock("~/services/models", () => ({
	listModelsByOutputModality: vi.fn(),
}));

describe("listCanvasModels", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns only models with a prompt field in inputSchema", async () => {
		vi.mocked(listModelsByOutputModality).mockResolvedValue({
			"image-model-a": {
				name: "Image Model A",
				provider: "replicate",
				modalities: { input: ["text"], output: ["image"] },
				inputSchema: {
					fields: [{ name: "prompt", type: "string", required: true }],
				},
			},
			"image-model-b": {
				name: "Image Model B",
				provider: "replicate",
				modalities: { input: ["image"], output: ["image"] },
				inputSchema: {
					fields: [{ name: "image", type: "file", required: true }],
				},
			},
			"image-model-c": {
				name: "Image Model C",
				provider: "replicate",
				modalities: { input: ["text", "image"], output: ["image"] },
				inputSchema: {
					fields: [
						{ name: "prompt", type: "string", required: true },
						{ name: "image", type: "array", required: true },
					],
				},
			},
		} as any);

		const result = await listCanvasModels({
			env: {} as any,
			mode: "image",
			userId: 123,
		});

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("image-model-a");
		expect(result[0].requiresReferenceImage).toBe(false);
		expect(result[1].id).toBe("image-model-c");
		expect(result[1].requiresReferenceImage).toBe(true);
	});
});
