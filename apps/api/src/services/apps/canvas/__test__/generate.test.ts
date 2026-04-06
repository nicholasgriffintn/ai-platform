import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByModel } from "~/lib/providers/models";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import { generateCanvasBatch } from "../generate";
import { prepareCanvasInputForModel } from "../prepare-input";
import { validateCanvasModelInputRequirements } from "../input-requirements";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

vi.mock("~/services/apps/replicate/execute", () => ({
	executeReplicateModel: vi.fn(),
}));

vi.mock("../prepare-input", () => ({
	prepareCanvasInputForModel: vi.fn(),
}));

vi.mock("../input-requirements", () => ({
	validateCanvasModelInputRequirements: vi.fn(),
}));

const baseModel = {
	matchingModel: "vendor/model-a",
	name: "Model A",
	provider: "bedrock",
	modalities: {
		input: ["text"],
		output: ["image"],
	},
	inputSchema: {
		fields: [{ name: "prompt", type: "string", required: true }],
	},
};

describe("generateCanvasBatch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getModelConfigByModel).mockResolvedValue(baseModel as any);
		vi.mocked(validateCanvasModelInputRequirements).mockReturnValue(null);
		vi.mocked(prepareCanvasInputForModel).mockReturnValue({ prompt: "hello" });
	});

	it("queues canvas generations through shared execution with canvas storage metadata", async () => {
		vi.mocked(executeReplicateModel).mockResolvedValue({
			data: {
				id: "gen-1",
				status: "processing",
			},
		} as any);

		const result = await generateCanvasBatch({
			user: { id: 123 } as any,
			params: {
				mode: "image",
				prompt: "hello",
				modelIds: ["model-a"],
			},
		});

		expect(executeReplicateModel).toHaveBeenCalledWith(
			expect.objectContaining({
				params: expect.objectContaining({ modelId: "model-a" }),
				storage: {
					appId: "canvas",
					itemType: "generation",
					extraData: { mode: "image" },
				},
			}),
		);

		expect(result).toEqual([
			{
				modelId: "model-a",
				modelName: "Model A",
				provider: "bedrock",
				status: "processing",
				generationId: "gen-1",
				error: undefined,
			},
		]);
	});

	it("returns failed status when model modality is incompatible", async () => {
		vi.mocked(getModelConfigByModel).mockResolvedValue({
			...baseModel,
			modalities: {
				input: ["text"],
				output: ["video"],
			},
		} as any);

		const result = await generateCanvasBatch({
			user: { id: 123 } as any,
			params: {
				mode: "image",
				prompt: "hello",
				modelIds: ["model-a"],
			},
		});

		expect(result).toHaveLength(1);
		expect(result[0].status).toBe("failed");
		expect(result[0].error).toContain("does not support image output");
	});
});
