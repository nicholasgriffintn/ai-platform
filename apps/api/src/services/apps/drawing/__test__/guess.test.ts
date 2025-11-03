import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { guessDrawingFromImage } from "../guess";

vi.mock("~/lib/context/serviceContext", () => ({
	resolveServiceContext: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "test-guess-id"),
}));

vi.mock("~/constants/app", () => ({
	gatewayId: "test-gateway-id",
}));

vi.mock("~/lib/prompts", () => ({
	guessDrawingPrompt: vi.fn(
		(usedGuesses) =>
			`Guess what this drawing is. Avoid these: ${Array.from(usedGuesses).join(", ")}`,
	),
}));

const mockAppDataRepo = {
	createAppDataWithItem: vi.fn(),
};

const mockUser = {
	id: 123,
	email: "test@example.com",
	username: "testuser",
	created_at: "2023-01-01T00:00:00Z",
	updated_at: "2023-01-01T00:00:00Z",
} as any;

const mockEnv = {
	AI: {
		run: vi.fn(),
	},
	DATABASE_URL: "test-url",
	API_KEY: "test-key",
} as any;

describe("guessDrawingFromImage", () => {
	let mockContext: any;

	beforeEach(() => {
		mockContext = {
			ensureDatabase: vi.fn(),
			repositories: {
				appData: mockAppDataRepo,
			},
			env: mockEnv,
		};
		mockAppDataRepo.createAppDataWithItem.mockReset();
		mockEnv.AI.run.mockReset();
		vi.mocked(resolveServiceContext).mockReturnValue(mockContext);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should throw AssistantError when drawing is missing", async () => {
		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: {},
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: {},
				user: mockUser,
			}),
		).rejects.toThrow("Missing drawing");
	});

	it("should successfully generate guess for valid drawing", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "A cat sitting on a windowsill",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const result = await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(mockContext.ensureDatabase).toHaveBeenCalled();

		expect(mockEnv.AI.run).toHaveBeenCalledWith(
			"@cf/llava-hf/llava-1.5-7b-hf",
			{
				prompt: expect.stringContaining("Guess what this drawing is"),
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

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"drawings",
			"test-guess-id",
			"guess",
			{
				guess: "A cat sitting on a windowsill",
				timestamp: expect.any(String),
			},
		);

		expect(result).toEqual({
			status: "success",
			content: "A cat sitting on a windowsill",
			completion_id: "test-guess-id",
		});
	});

	it("should handle AI response with trimming", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "  A dog playing in a park  ",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const result = await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(result.content).toBe("A dog playing in a park");
	});

	it("should throw AssistantError when AI fails to generate description", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: null,
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Failed to generate description");
	});

	it("should throw AssistantError when AI returns undefined description", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Failed to generate description");
	});

	it("should handle AI errors gracefully", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		mockEnv.AI.run.mockRejectedValue(new Error("AI service unavailable"));

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("AI service unavailable");
	});

	it("should handle repository errors gracefully", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "A beautiful sunset",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(
			guessDrawingFromImage({
				env: mockEnv,
				request: { drawing: mockDrawing },
				user: mockUser,
			}),
		).rejects.toThrow("Database error");
	});

	it("should generate unique ID for each guess", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "A mountain landscape",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(generateId).toHaveBeenCalled();
	});

	it("should pass user email to AI gateway", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "A tree in the forest",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const userWithEmail = { ...mockUser, email: "custom@test.com" };

		await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: userWithEmail,
		});

		expect(mockEnv.AI.run).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(Object),
			expect.objectContaining({
				gateway: expect.objectContaining({
					metadata: {
						email: "custom@test.com",
					},
				}),
			}),
		);
	});

	it("should convert array buffer to image array correctly", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(4);
		const uint8Array = new Uint8Array(mockArrayBuffer);
		uint8Array[0] = 255;
		uint8Array[1] = 0;
		uint8Array[2] = 128;
		uint8Array[3] = 64;

		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "Test image",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(mockEnv.AI.run).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				image: [255, 0, 128, 64],
			}),
			expect.any(Object),
		);
	});

	it("should save guess with timestamp", async () => {
		const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
		const mockArrayBuffer = new ArrayBuffer(100);
		vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

		const mockAIResponse = {
			description: "A house with a garden",
		};

		mockEnv.AI.run.mockResolvedValue(mockAIResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "app-data-123",
		});

		const mockDate = new Date("2023-01-01T12:00:00Z");
		vi.spyOn(global, "Date").mockImplementation(() => mockDate as any);

		await guessDrawingFromImage({
			env: mockEnv,
			request: { drawing: mockDrawing },
			user: mockUser,
		});

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"drawings",
			"test-guess-id",
			"guess",
			{
				guess: "A house with a garden",
				timestamp: "2023-01-01T12:00:00.000Z",
			},
		);

		vi.restoreAllMocks();
	});
});
