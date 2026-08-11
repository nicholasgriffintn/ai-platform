import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { generateImageFromDrawing } from "../create";
import { getDrawingDetails } from "../get-details";
import { guessDrawingFromImage } from "../guess";
import { listDrawings } from "../list";

const storage = {
	storeSourceFile: vi.fn(),
	storeOutputFile: vi.fn(),
};

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		static forPrivateAssets() {
			return storage;
		}
	},
}));
vi.mock("~/utils/id", () => ({ generateId: () => "drawing-1" }));

function record(overrides: Partial<OutputRecord> = {}): OutputRecord {
	return {
		id: "drawing-output-1",
		created_by_user_id: 7,
		project_id: null,
		conversation_id: null,
		parent_output_id: null,
		capability_id: "drawings",
		group_id: "drawing-1",
		kind: "drawing",
		title: "A red house",
		status: "ready",
		sensitivity: "personal",
		content:
			'{"description":"A red house","drawingUrl":"/sources/source-1/content","paintingUrl":"/outputs/painting-1/content"}',
		storage_key: null,
		mime_type: null,
		filename: null,
		byte_size: null,
		revision: 1,
		created_at: "2026-08-11T10:00:00Z",
		updated_at: null,
		...overrides,
	};
}

function context(outputs: Record<string, unknown>, aiRun = vi.fn()): ServiceContext {
	return {
		env: { DB: {}, AI: { run: aiRun } },
		ensureDatabase: () => undefined,
		repositories: { outputs },
	} as unknown as ServiceContext;
}

const user = { id: 7, email: "artist@example.com" } as never;

describe("drawing outputs", () => {
	beforeEach(() => vi.clearAllMocks());

	it("lists and reads personal drawing outputs", async () => {
		const outputs = {
			listPersonalOutputs: vi.fn().mockResolvedValue([record()]),
			getPersonalOutput: vi.fn().mockResolvedValue(record()),
		};
		const serviceContext = context(outputs);

		expect(await listDrawings({ context: serviceContext, userId: 7 })).toEqual([
			expect.objectContaining({ id: "drawing-output-1", description: "A red house" }),
		]);
		expect(
			await getDrawingDetails({
				context: serviceContext,
				userId: 7,
				drawingId: "drawing-output-1",
			}),
		).toMatchObject({ paintingUrl: "/outputs/painting-1/content" });
	});

	it("stores a generated guess as an output", async () => {
		const outputs = { createOutput: vi.fn().mockResolvedValue(record({ kind: "guess" })) };
		const aiRun = vi.fn().mockResolvedValue({ description: "A cat" });

		const result = await guessDrawingFromImage({
			context: context(outputs, aiRun),
			request: { drawing: new Blob(["pixels"]) },
			user,
		});

		expect(result.content).toBe("A cat");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({ capabilityId: "drawings", kind: "guess" }),
		);
	});

	it("links the source drawing to both generated outputs", async () => {
		const outputs = {
			createOutput: vi.fn().mockResolvedValue(record()),
			attachSources: vi.fn().mockResolvedValue(undefined),
		};
		const aiRun = vi
			.fn()
			.mockResolvedValueOnce({ description: "A red house" })
			.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
		storage.storeSourceFile.mockResolvedValue({
			sourceId: "source-1",
			key: "drawings/drawing-1/image.png",
			url: "/sources/source-1/content",
		});
		storage.storeOutputFile.mockResolvedValue({
			outputId: "painting-1",
			key: "drawings/drawing-1/painting.png",
			url: "/outputs/painting-1/content",
		});

		const result = await generateImageFromDrawing({
			context: context(outputs, aiRun),
			request: { drawing: new Blob(["pixels"]) },
			user,
		});

		expect(result).toMatchObject({
			output_id: "drawing-output-1",
			data: { drawingSourceId: "source-1", paintingOutputId: "painting-1" },
		});
		expect(outputs.attachSources).toHaveBeenCalledWith("drawing-output-1", ["source-1"]);
		expect(outputs.attachSources).toHaveBeenCalledWith("painting-1", ["source-1"]);
	});
});
