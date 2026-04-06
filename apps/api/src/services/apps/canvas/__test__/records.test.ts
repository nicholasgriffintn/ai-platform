import { describe, expect, it } from "vitest";

import { mapCanvasGenerationRecord } from "../records";

describe("mapCanvasGenerationRecord", () => {
	it("maps stored canvas generation data with normalized status", () => {
		const result = mapCanvasGenerationRecord({
			id: "record-1",
			user_id: 1,
			app_id: "canvas",
			item_id: "invoke-1",
			item_type: "generation",
			data: JSON.stringify({
				modelId: "model-a",
				modelName: "Model A",
				provider: "bedrock",
				mode: "video",
				status: "in_progress",
				input: { prompt: "hello" },
				output: { url: "https://cdn.example/video.mp4" },
				createdAt: "2026-04-05T12:00:00.000Z",
			}),
			created_at: "2026-04-05T12:00:00.000Z",
			updated_at: "2026-04-05T12:00:01.000Z",
		} as any);

		expect(result).toEqual({
			id: "record-1",
			itemId: "invoke-1",
			modelId: "model-a",
			modelName: "Model A",
			provider: "bedrock",
			mode: "video",
			status: "processing",
			createdAt: "2026-04-05T12:00:00.000Z",
			updatedAt: "2026-04-05T12:00:01.000Z",
			input: { prompt: "hello" },
			output: { url: "https://cdn.example/video.mp4" },
			error: undefined,
			predictionData: undefined,
		});
	});

	it("falls back to record metadata when stored payload is missing fields", () => {
		const result = mapCanvasGenerationRecord({
			id: "record-2",
			user_id: 1,
			app_id: "canvas",
			item_id: "invoke-2",
			item_type: "generation",
			data: JSON.stringify({
				status: "completed",
			}),
			created_at: "2026-04-04T10:00:00.000Z",
			updated_at: "2026-04-04T10:00:00.000Z",
		} as any);

		expect(result.modelId).toBe("invoke-2");
		expect(result.mode).toBeUndefined();
		expect(result.status).toBe("completed");
		expect(result.createdAt).toBe("2026-04-04T10:00:00.000Z");
	});
});
