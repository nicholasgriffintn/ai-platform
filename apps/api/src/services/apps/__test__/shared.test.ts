import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { getSharedItem, shareItem } from "../shared";

const mockAppDataRepo = {
	getAppDataByItemId: vi.fn(),
	getAppDataByShareId: vi.fn(),
	updateAppDataWithShareId: vi.fn(),
};

vi.mock("~/repositories/AppDataRepository", () => ({
	AppDataRepository: vi.fn(() => mockAppDataRepo),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "test-share-id-123"),
}));

describe("shared services", () => {
	const mockEnv = {} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("shareItem", () => {
		it("should return existing share ID if item already has one", async () => {
			const mockAppData = {
				id: "item-1",
				user_id: 123,
				share_id: "existing-share-id",
			};

			mockAppDataRepo.getAppDataByItemId.mockResolvedValue(mockAppData);

			const result = await shareItem({
				userId: 123,
				id: "item-1",
				env: mockEnv,
			});

			expect(result.shareId).toBe("existing-share-id");
			expect(mockAppDataRepo.updateAppDataWithShareId).not.toHaveBeenCalled();
		});

		it("should create new share ID if item doesn't have one", async () => {
			const mockAppData = {
				id: "item-1",
				user_id: 123,
				share_id: null,
			};

			mockAppDataRepo.getAppDataByItemId.mockResolvedValue(mockAppData);

			const result = await shareItem({
				userId: 123,
				id: "item-1",
				env: mockEnv,
			});

			expect(result.shareId).toBe("test-share-id-123");
			expect(mockAppDataRepo.updateAppDataWithShareId).toHaveBeenCalledWith(
				"item-1",
				"test-share-id-123",
			);
		});

		it("should throw error if user ID is missing", async () => {
			await expect(
				shareItem({
					userId: 0,
					id: "item-1",
					env: mockEnv,
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should throw error if item not found", async () => {
			mockAppDataRepo.getAppDataByItemId.mockResolvedValue(null);

			await expect(
				shareItem({
					userId: 123,
					id: "item-1",
					env: mockEnv,
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should throw error if item doesn't belong to user", async () => {
			const mockAppData = {
				id: "item-1",
				user_id: 456,
				share_id: null,
			};

			mockAppDataRepo.getAppDataByItemId.mockResolvedValue(mockAppData);

			await expect(
				shareItem({
					userId: 123,
					id: "item-1",
					env: mockEnv,
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});
	});

	describe("getSharedItem", () => {
		it("should return shared item with parsed data", async () => {
			const mockAppData = {
				id: "item-1",
				user_id: 123,
				app_id: "notes",
				item_id: "note-1",
				item_type: "note",
				data: '{"title": "Test Note", "content": "Test content"}',
				share_id: "share-123",
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T00:00:00Z",
			};

			mockAppDataRepo.getAppDataByShareId.mockResolvedValue(mockAppData);

			const result = await getSharedItem({
				env: mockEnv,
				shareId: "share-123",
			});

			expect(result).toEqual({
				id: "item-1",
				userId: 123,
				appId: "notes",
				itemId: "note-1",
				itemType: "note",
				data: { title: "Test Note", content: "Test content" },
				shareId: "share-123",
				createdAt: "2023-01-01T00:00:00Z",
				updatedAt: "2023-01-01T00:00:00Z",
			});
		});

		it("should throw error if share ID is missing", async () => {
			await expect(
				getSharedItem({
					env: mockEnv,
					shareId: "",
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should throw error if shared item not found", async () => {
			mockAppDataRepo.getAppDataByShareId.mockResolvedValue(null);

			await expect(
				getSharedItem({
					env: mockEnv,
					shareId: "non-existent",
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should handle invalid JSON data gracefully", async () => {
			const mockAppData = {
				id: "item-1",
				user_id: 123,
				app_id: "notes",
				item_id: "note-1",
				item_type: "note",
				data: "invalid-json",
				share_id: "share-123",
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T00:00:00Z",
			};

			mockAppDataRepo.getAppDataByShareId.mockResolvedValue(mockAppData);

			const result = await getSharedItem({
				env: mockEnv,
				shareId: "share-123",
			});

			expect(result.data).toEqual({});
		});
	});
});
