import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";
import { generateImageFromDrawing } from "../create";

vi.mock("~/lib/context/serviceContext", () => ({
	resolveServiceContext: vi.fn(),
}));

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		static forPrivateAssets() {
			return storageServiceImpl ?? mockStorageService;
		}

		constructor() {
			return storageServiceImpl ?? mockStorageService;
		}
	},
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "test-drawing-id"),
}));

vi.mock("~/constants/app", () => ({
	gatewayId: "test-gateway-id",
}));

vi.mock("~/lib/prompts", () => ({
	drawingDescriptionPrompt: vi.fn(() => "Describe this drawing in detail"),
}));

const mockAppDataRepo = {
	createAppDataWithItem: vi.fn(),
	getAppDataById: vi.fn(),
};

const mockStorageService = {
	uploadObject: vi.fn(),
	storePrivateAsset: vi.fn(),
};

let storageServiceImpl: typeof mockStorageService | undefined;
let originalResponse: typeof Response | undefined;

const buildResponseMock = (fallbackBuffer: ArrayBuffer) =>
	class Response {
		private blob: any;
		constructor(blob: any) {
			this.blob = blob;
		}
		async arrayBuffer() {
			if (this.blob?.arrayBuffer) {
				return this.blob.arrayBuffer();
			}
			return fallbackBuffer;
		}
	};

const mockConversationManager = {
	add: vi.fn(),
} as any;

const mockUser = {
	id: 123,
	email: "test@example.com",
	username: "testuser",
	created_at: "2023-01-01T00:00:00Z",
	updated_at: "2023-01-01T00:00:00Z",
} as any;

const mockEnv = {
	DB: {},
	AI: {
		run: vi.fn(),
	},
	ASSETS_BUCKET: "test-bucket",
	PRIVATE_ASSETS_BUCKET: "private-test-bucket",
	API_BASE_URL: "https://api.example.com",
	PUBLIC_ASSETS_URL: "https://assets.example.com",
	DATABASE_URL: "test-url",
	API_KEY: "test-key",
} as any;

describe("generateImageFromDrawing", () => {
	let mockContext: any;

	beforeEach(() => {
		if (!originalResponse) {
			originalResponse = global.Response;
		}
		storageServiceImpl = mockStorageService;
		mockContext = {
			ensureDatabase: vi.fn(),
			repositories: {
				appData: mockAppDataRepo,
			},
			env: mockEnv,
		};
		mockAppDataRepo.createAppDataWithItem.mockReset();
		mockAppDataRepo.getAppDataById.mockReset();
		mockEnv.AI.run.mockReset();
		mockStorageService.uploadObject.mockReset();
		mockStorageService.storePrivateAsset.mockReset();
		mockStorageService.storePrivateAsset.mockImplementation(async (request) => ({
			assetId: request.filename === "painting.png" ? "painting-asset-id" : "drawing-asset-id",
			key: request.key,
			url:
				request.filename === "painting.png"
					? "https://api.example.com/assets/painting-asset-id"
					: "https://api.example.com/assets/drawing-asset-id",
		}));
		mockAppDataRepo.getAppDataById.mockResolvedValue({
			id: "app-data-123",
			data: JSON.stringify({}),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});
		vi.mocked(resolveServiceContext).mockReturnValue(mockContext);
	});

	afterEach(() => {
		vi.clearAllMocks();
		if (originalResponse) {
			global.Response = originalResponse;
		}
	});

	it("should throw AssistantError when drawing is missing", async () => {
		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: {},
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: {},
				user: mockUser,
			}),
		).rejects.toThrow("Missing drawing");
	});

	it("should successfully generate image from drawing", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = {
			description: "A beautiful landscape with mountains",
		};

		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});
		const mockPaintingArrayBuffer = new ArrayBuffer(200);
		vi.spyOn(mockPaintingBlob, "arrayBuffer").mockResolvedValue(mockPaintingArrayBuffer);

		global.Response = buildResponseMock(mockPaintingArrayBuffer) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});
		mockAppDataRepo.getAppDataById.mockResolvedValue({
			id: "app-data-123",
			data: JSON.stringify({
				description: "A beautiful landscape with mountains",
				drawingUrl: "https://api.example.com/assets/drawing-asset-id",
				paintingUrl: "https://api.example.com/assets/painting-asset-id",
				drawingKey: "drawings/test-drawing-id/image.png",
				paintingKey: "drawings/test-drawing-id/painting.png",
			}),
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		});

		const result = await generateImageFromDrawing({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(mockContext.ensureDatabase).toHaveBeenCalled();

		expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
		expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
			1,
			"@cf/llava-hf/llava-1.5-7b-hf",
			{
				prompt: "Describe this drawing in detail",
				image: expect.any(Array),
			},
			{
				gateway: {
					id: "test-gateway-id",
					skipCache: false,
					cacheTtl: 3360,
					metadata: {
						email: "test@example.com",
					},
				},
			},
		);

		expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
			2,
			"@cf/runwayml/stable-diffusion-v1-5-img2img",
			{
				prompt: "A beautiful landscape with mountains",
				image: expect.any(Array),
				guidance: 8,
				strength: 0.85,
				num_inference_steps: 50,
			},
			{
				gateway: {
					id: "test-gateway-id",
					skipCache: false,
					cacheTtl: 3360,
					metadata: {
						email: "test@example.com",
					},
				},
			},
		);

		expect(mockStorageService.storePrivateAsset).toHaveBeenCalledTimes(2);
		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"drawings",
			"test-drawing-id",
			"drawing",
			{
				description: "A beautiful landscape with mountains",
				drawingUrl: "https://api.example.com/assets/drawing-asset-id",
				drawingAssetId: "drawing-asset-id",
				paintingUrl: "https://api.example.com/assets/painting-asset-id",
				paintingAssetId: "painting-asset-id",
				drawingKey: "drawings/test-drawing-id/image.png",
				paintingKey: "drawings/test-drawing-id/painting.png",
			},
		);

		expect(result).toEqual({
			status: "success",
			app_data_id: "app-data-123",
			completion_id: "test-drawing-id",
			data: {
				description: "A beautiful landscape with mountains",
				drawingUrl: "https://api.example.com/assets/drawing-asset-id",
				drawingAssetId: "drawing-asset-id",
				paintingUrl: "https://api.example.com/assets/painting-asset-id",
				paintingAssetId: "painting-asset-id",
				drawingKey: "drawings/test-drawing-id/image.png",
				paintingKey: "drawings/test-drawing-id/painting.png",
			},
		});
	});

	it("should use provided drawingId when available", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		await generateImageFromDrawing({
			env: mockEnv,
			request: {
				drawing: mockDrawing,
				drawingId: "custom-drawing-id",
			},
			user: mockUser,
		});

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"drawings",
			"custom-drawing-id",
			"drawing",
			expect.any(Object),
		);
	});

	it("should use existingDrawingId when provided", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		await generateImageFromDrawing({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
			existingDrawingId: "existing-drawing-id",
		});

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"drawings",
			"existing-drawing-id",
			"drawing",
			expect.any(Object),
		);
	});

	it("should handle conversation manager integration", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "A beautiful sunset" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		mockConversationManager.add
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ status: "conversation_success" });

		const result = await generateImageFromDrawing({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
			conversationManager: mockConversationManager,
		});

		expect(mockConversationManager.add).toHaveBeenCalledTimes(2);
		expect(mockConversationManager.add).toHaveBeenNthCalledWith(1, "test-drawing-id", {
			role: "user",
			content: "Generate a drawing with this prompt: A beautiful sunset",
			app: "drawings",
		});

		expect(mockConversationManager.add).toHaveBeenNthCalledWith(2, "test-drawing-id", {
			role: "assistant",
			name: "drawing_generate",
			content: "A beautiful sunset",
			data: expect.objectContaining({
				drawingUrl: "https://api.example.com/assets/drawing-asset-id",
				paintingUrl: "https://api.example.com/assets/painting-asset-id",
			}),
		});

		expect(result.status).toBe("success");
		// @ts-ignore - app_data_id exists on the returned object in tests
		expect(result.app_data_id).toBe("app-data-123");
	});

	it("should handle missing description gracefully", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = {};
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const result = await generateImageFromDrawing({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
			2,
			"@cf/runwayml/stable-diffusion-v1-5-img2img",
			expect.objectContaining({
				prompt: "Convert this drawing into a painting.",
			}),
			expect.any(Object),
		);

		expect(result.data.description).toBe("Untitled drawing");
	});

	it("should throw AssistantError when drawing upload fails", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		mockStorageService.storePrivateAsset.mockRejectedValue(new Error("Upload failed"));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Error uploading drawing");
	});

	it("should throw AssistantError when painting upload fails", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockStorageService.storePrivateAsset
			.mockResolvedValueOnce({
				assetId: "drawing-asset-id",
				key: "drawings/test-drawing-id/image.png",
				url: "https://api.example.com/assets/drawing-asset-id",
			})
			.mockRejectedValueOnce(new Error("Painting upload failed"));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should handle AI description generation errors", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		mockEnv.AI.run.mockRejectedValue(new Error("AI service unavailable"));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("AI service unavailable");
	});

	it("should handle AI painting generation errors", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockRejectedValueOnce(new Error("Painting generation failed"));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Painting generation failed");
	});

	it("should handle repository errors gracefully", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockRejectedValue(new Error("Database error"));

		await expect(
			generateImageFromDrawing({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Database error");
	});

	it("should handle environment without PUBLIC_ASSETS_URL", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockDescriptionResponse = { description: "Test description" };
		const mockPaintingBlob = new Blob(["fake-painting-data"], {
			type: "image/png",
		});

		global.Response = buildResponseMock(new ArrayBuffer(200)) as any;

		mockEnv.AI.run
			.mockResolvedValueOnce(mockDescriptionResponse)
			.mockResolvedValueOnce(mockPaintingBlob);

		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const envWithoutAssets = { ...mockEnv, PUBLIC_ASSETS_URL: undefined };
		const contextWithoutAssets = {
			...mockContext,
			env: envWithoutAssets,
		};
		vi.mocked(resolveServiceContext).mockReturnValueOnce(contextWithoutAssets as any);

		const result = await generateImageFromDrawing({
			env: envWithoutAssets,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(result.data.drawingUrl).toBe("https://api.example.com/assets/drawing-asset-id");
		expect(result.data.paintingUrl).toBe("https://api.example.com/assets/painting-asset-id");
	});
});
