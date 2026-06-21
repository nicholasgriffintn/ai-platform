import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByModel } from "~/lib/providers/models";
import { executeModelGeneration } from "~/services/apps/generation/execute";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import type { ModelConfigItem } from "@assistant/schemas";
import type { IUser } from "~/types";
import { generateCanvasBatch } from "../generate";
import { prepareCanvasInputForModel } from "../prepare-input";
import { validateCanvasModelInputRequirements } from "../input-requirements";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

vi.mock("~/services/apps/replicate/execute", () => ({
	executeReplicateModel: vi.fn(),
}));

vi.mock("~/services/apps/generation/execute", () => ({
	executeModelGeneration: vi.fn(),
}));

vi.mock("../prepare-input", () => ({
	prepareCanvasInputForModel: vi.fn(),
}));

vi.mock("../input-requirements", () => ({
	validateCanvasModelInputRequirements: vi.fn(),
}));

const baseModel: ModelConfigItem = {
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

const user: IUser = {
	id: 123,
	name: null,
	avatar_url: null,
	email: "user@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-06-03T00:00:00.000Z",
	updated_at: "2026-06-03T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

describe("generateCanvasBatch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getModelConfigByModel).mockResolvedValue(baseModel);
		vi.mocked(validateCanvasModelInputRequirements).mockReturnValue(null);
		vi.mocked(prepareCanvasInputForModel).mockReturnValue({ prompt: "hello" });
	});

	it("queues canvas generations through shared execution with canvas storage metadata", async () => {
		vi.mocked(getModelConfigByModel).mockResolvedValue({
			...baseModel,
			provider: "replicate",
		});
		vi.mocked(executeReplicateModel).mockResolvedValue({
			data: {
				id: "gen-1",
				status: "processing",
			},
			status: "success",
			content: "Generation started: gen-1",
		});

		const result = await generateCanvasBatch({
			user,
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
				provider: "replicate",
				status: "processing",
				generationId: "gen-1",
				error: undefined,
			},
		]);
	});

	it("stores synchronous OpenAI image generations as completed canvas results", async () => {
		vi.mocked(getModelConfigByModel).mockResolvedValue({
			...baseModel,
			matchingModel: "gpt-image-2",
			name: "GPT Image 2",
			provider: "openai",
		});
		vi.mocked(executeModelGeneration).mockResolvedValue({
			data: {
				id: "stored-openai-generation",
				status: "completed",
			},
			status: "success",
			content: "Generation completed: stored-openai-generation",
		});

		const result = await generateCanvasBatch({
			user,
			params: {
				mode: "image",
				prompt: "hello",
				modelIds: ["gpt-image-2"],
			},
		});

		expect(executeModelGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				params: {
					modelId: "gpt-image-2",
					input: { prompt: "hello" },
				},
				storage: {
					appId: "canvas",
					itemType: "generation",
					extraData: { mode: "image" },
				},
			}),
		);
		expect(executeReplicateModel).not.toHaveBeenCalled();
		expect(result).toEqual([
			{
				modelId: "gpt-image-2",
				modelName: "GPT Image 2",
				provider: "openai",
				status: "completed",
				generationId: "stored-openai-generation",
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
		});

		const result = await generateCanvasBatch({
			user,
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
