import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryManager } from "~/repositories";
import { AssistantError } from "~/utils/errors";
import { getDrawingDetails } from "../get-details";

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		error: vi.fn(),
	}),
}));

const mockAppDataRepo = {
	getAppDataById: vi.fn(),
};

const mockEnv = {
	DATABASE_URL: "test-url",
	API_KEY: "test-key",
} as any;

describe("getDrawingDetails", () => {
	beforeEach(() => {
		vi.mocked(RepositoryManager.getInstance).mockReturnValue({
			appData: mockAppDataRepo,
		} as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should throw AssistantError when userId is missing", async () => {
		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 0,
				drawingId: "drawing-1",
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 0,
				drawingId: "drawing-1",
			}),
		).rejects.toThrow("Drawing ID and user ID are required");
	});

	it("should throw AssistantError when drawingId is missing", async () => {
		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "",
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "",
			}),
		).rejects.toThrow("Drawing ID and user ID are required");
	});

	it("should return drawing details for valid drawing", async () => {
		const mockDrawing = {
			id: "drawing-1",
			user_id: 123,
			app_id: "drawings",
			data: JSON.stringify({
				description: "A beautiful landscape",
				drawingUrl: "https://example.com/drawing1.png",
				paintingUrl: "https://example.com/painting1.png",
				metadata: { style: "realistic" },
			}),
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockDrawing);

		const result = await getDrawingDetails({
			env: mockEnv,
			userId: 123,
			drawingId: "drawing-1",
		});

		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledWith("drawing-1");
		expect(result).toEqual({
			id: "drawing-1",
			description: "A beautiful landscape",
			drawingUrl: "https://example.com/drawing1.png",
			paintingUrl: "https://example.com/painting1.png",
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: { style: "realistic" },
		});
	});

	it("should throw NOT_FOUND error when drawing doesn't exist", async () => {
		mockAppDataRepo.getAppDataById.mockResolvedValue(null);

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "non-existent",
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "non-existent",
			}),
		).rejects.toThrow("Drawing not found");
	});

	it("should throw NOT_FOUND error when drawing doesn't belong to user", async () => {
		const mockDrawing = {
			id: "drawing-1",
			user_id: 456,
			app_id: "drawings",
			data: JSON.stringify({
				description: "Someone else's drawing",
			}),
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockDrawing);

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "drawing-1",
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "drawing-1",
			}),
		).rejects.toThrow("Drawing not found");
	});

	it("should throw NOT_FOUND error when entry is not a drawing", async () => {
		const mockEntry = {
			id: "entry-1",
			user_id: 123,
			app_id: "articles",
			data: JSON.stringify({
				title: "Some article",
			}),
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockEntry);

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "entry-1",
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "entry-1",
			}),
		).rejects.toThrow("Drawing not found");
	});

	it("should handle malformed JSON data gracefully", async () => {
		const mockDrawing = {
			id: "drawing-1",
			user_id: 123,
			app_id: "drawings",
			data: "invalid-json",
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockDrawing);

		const result = await getDrawingDetails({
			env: mockEnv,
			userId: 123,
			drawingId: "drawing-1",
		});

		expect(result).toEqual({
			id: "drawing-1",
			description: undefined,
			drawingUrl: undefined,
			paintingUrl: undefined,
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: undefined,
		});
	});

	it("should handle empty data object gracefully", async () => {
		const mockDrawing = {
			id: "drawing-1",
			user_id: 123,
			app_id: "drawings",
			data: JSON.stringify({}),
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockDrawing);

		const result = await getDrawingDetails({
			env: mockEnv,
			userId: 123,
			drawingId: "drawing-1",
		});

		expect(result).toEqual({
			id: "drawing-1",
			description: undefined,
			drawingUrl: undefined,
			paintingUrl: undefined,
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: undefined,
		});
	});

	it("should handle repository errors gracefully", async () => {
		mockAppDataRepo.getAppDataById.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(
			getDrawingDetails({
				env: mockEnv,
				userId: 123,
				drawingId: "drawing-1",
			}),
		).rejects.toThrow("Database error");
	});
});
