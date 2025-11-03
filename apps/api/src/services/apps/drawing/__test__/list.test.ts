import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { listDrawings } from "../list";

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		error: vi.fn(),
	}),
}));

const mockAppDataRepo = {
	getAppDataByUserAndApp: vi.fn(),
};

const mockEnv = {
	DATABASE_URL: "test-url",
	API_KEY: "test-key",
} as any;

const createContext = () =>
	({
		ensureDatabase: vi.fn(),
		repositories: {
			appData: mockAppDataRepo,
		},
		env: mockEnv,
	}) as any;

describe("listDrawings", () => {
	let mockContext: any;

	beforeEach(() => {
		mockAppDataRepo.getAppDataByUserAndApp.mockReset();
		mockContext = createContext();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should throw AssistantError when userId is missing", async () => {
		await expect(
			listDrawings({
				context: mockContext,
				userId: 0,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			listDrawings({
				context: mockContext,
				userId: 0,
			}),
		).rejects.toThrow("User ID is required");
	});

	it("should return parsed drawings for valid user", async () => {
		const mockDrawings = [
			{
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
			},
			{
				id: "drawing-2",
				user_id: 123,
				app_id: "drawings",
				data: JSON.stringify({
					description: "Abstract art",
					drawingUrl: "https://example.com/drawing2.png",
					paintingUrl: "https://example.com/painting2.png",
				}),
				created_at: "2023-01-02T00:00:00Z",
				updated_at: "2023-01-02T01:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockDrawings);

		const result = await listDrawings({
			context: mockContext,
			userId: 123,
		});

		expect(mockContext.ensureDatabase).toHaveBeenCalled();

		expect(mockAppDataRepo.getAppDataByUserAndApp).toHaveBeenCalledWith(
			123,
			"drawings",
		);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			id: "drawing-1",
			description: "A beautiful landscape",
			drawingUrl: "https://example.com/drawing1.png",
			paintingUrl: "https://example.com/painting1.png",
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: { style: "realistic" },
		});
		expect(result[1]).toEqual({
			id: "drawing-2",
			description: "Abstract art",
			drawingUrl: "https://example.com/drawing2.png",
			paintingUrl: "https://example.com/painting2.png",
			createdAt: "2023-01-02T00:00:00Z",
			updatedAt: "2023-01-02T01:00:00Z",
			metadata: undefined,
		});
	});

	it("should handle malformed JSON data gracefully", async () => {
		const mockDrawings = [
			{
				id: "drawing-1",
				user_id: 123,
				app_id: "drawings",
				data: "invalid-json",
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T01:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockDrawings);

		const result = await listDrawings({
			context: mockContext,
			userId: 123,
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "drawing-1",
			description: undefined,
			drawingUrl: undefined,
			paintingUrl: undefined,
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: undefined,
		});
	});

	it("should return empty array when no drawings exist", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue([]);

		const result = await listDrawings({
			context: mockContext,
			userId: 123,
		});

		expect(result).toEqual([]);
	});

	it("should handle repository errors gracefully", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(
			listDrawings({
				context: mockContext,
				userId: 123,
			}),
		).rejects.toThrow("Database error");
	});

	it("should call repository with correct parameters", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue([]);

		await listDrawings({
			context: mockContext,
			userId: 456,
		});

		expect(mockAppDataRepo.getAppDataByUserAndApp).toHaveBeenCalledWith(
			456,
			"drawings",
		);
	});

	it("should handle empty data object gracefully", async () => {
		const mockDrawings = [
			{
				id: "drawing-1",
				user_id: 123,
				app_id: "drawings",
				data: JSON.stringify({}),
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T01:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockDrawings);

		const result = await listDrawings({
			context: mockContext,
			userId: 123,
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "drawing-1",
			description: undefined,
			drawingUrl: undefined,
			paintingUrl: undefined,
			createdAt: "2023-01-01T00:00:00Z",
			updatedAt: "2023-01-01T01:00:00Z",
			metadata: undefined,
		});
	});
});
