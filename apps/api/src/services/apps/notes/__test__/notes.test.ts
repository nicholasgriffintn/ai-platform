import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { AssistantError } from "~/utils/errors";
import {
	createNote,
	deleteNote,
	getNote,
	listNotes,
	updateNote,
} from "../list";

const mockRepo = {
	getAppDataByUserAndApp: vi.fn(),
	getAppDataById: vi.fn(),
	createAppDataWithItem: vi.fn(),
	updateAppData: vi.fn(),
	deleteAppData: vi.fn(),
};

const mockChatProviderResponse = vi
	.fn()
	.mockResolvedValue({ response: JSON.stringify({}) });

vi.mock("~/lib/context/serviceContext", () => ({
	resolveServiceContext: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "test-note-id-123"),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn(() =>
		Promise.resolve({ model: "test-model", provider: "test-provider" }),
	),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => ({
		getResponse: mockChatProviderResponse,
	})),
}));

describe("notes service", () => {
	const mockEnv = {} as any;
	const mockUser = {
		id: 123,
		name: "Test User",
		avatar_url: null,
		email: "test@example.com",
		github_username: null,
		company: null,
		site: null,
		location: null,
		bio: null,
		twitter_username: null,
		role: null,
		created_at: "2023-01-01T00:00:00Z",
		updated_at: "2023-01-01T00:00:00Z",
		setup_at: null,
		terms_accepted_at: null,
		plan_id: null,
	};

	let mockContext: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockChatProviderResponse.mockReset();
		mockChatProviderResponse.mockResolvedValue({
			response: JSON.stringify({
				tags: ["ai"],
				summary: "Generated summary",
				keyTopics: ["topic"],
				wordCount: 2,
				readingTime: 1,
				contentType: "text",
				sentiment: "neutral",
			}),
		});
		mockContext = {
			ensureDatabase: vi.fn(),
			repositories: {
				appData: mockRepo,
			},
			env: mockEnv,
		};
		mockRepo.getAppDataByUserAndApp.mockReset();
		mockRepo.getAppDataById.mockReset();
		mockRepo.createAppDataWithItem.mockReset();
		mockRepo.updateAppData.mockReset();
		mockRepo.deleteAppData.mockReset();
		vi.mocked(resolveServiceContext).mockReturnValue(mockContext);
	});

	describe("listNotes", () => {
		it("should return list of notes for user", async () => {
			const mockNoteData = [
				{
					id: "note-1",
					data: '{"title": "Test Note 1", "content": "Content 1"}',
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				},
				{
					id: "note-2",
					data: '{"title": "Test Note 2", "content": "Content 2"}',
					created_at: "2023-01-02T00:00:00Z",
					updated_at: "2023-01-02T00:00:00Z",
				},
			];

			mockRepo.getAppDataByUserAndApp.mockResolvedValue(mockNoteData);

			const result = await listNotes({ env: mockEnv, userId: 123 });
			expect(mockContext.ensureDatabase).toHaveBeenCalled();

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				id: "note-1",
				title: "Test Note 1",
				content: "Content 1",
				createdAt: "2023-01-01T00:00:00Z",
				updatedAt: "2023-01-01T00:00:00Z",
				metadata: undefined,
			});
		});

		it("should throw error if user ID is missing", async () => {
			await expect(listNotes({ env: mockEnv, userId: 0 })).rejects.toThrow(
				AssistantError,
			);
		});

		it("should handle invalid JSON gracefully", async () => {
			const mockNoteData = [
				{
					id: "note-1",
					data: "invalid-json",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				},
			];

			mockRepo.getAppDataByUserAndApp.mockResolvedValue(mockNoteData);

			const result = await listNotes({ env: mockEnv, userId: 123 });

			expect(result[0].title).toBeUndefined();
			expect(result[0].content).toBeUndefined();
		});
	});

	describe("getNote", () => {
		it("should return note by ID", async () => {
			const mockNoteData = {
				id: "note-1",
				user_id: 123,
				app_id: "notes",
				data: '{"title": "Test Note", "content": "Test content"}',
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T00:00:00Z",
			};

			mockRepo.getAppDataById.mockResolvedValue(mockNoteData);

			const result = await getNote({
				env: mockEnv,
				userId: 123,
				noteId: "note-1",
			});

			expect(result).toEqual({
				id: "note-1",
				title: "Test Note",
				content: "Test content",
				createdAt: "2023-01-01T00:00:00Z",
				updatedAt: "2023-01-01T00:00:00Z",
				metadata: undefined,
			});
		});

		it("should throw error if note not found", async () => {
			mockRepo.getAppDataById.mockResolvedValue(null);

			await expect(
				getNote({ env: mockEnv, userId: 123, noteId: "non-existent" }),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should throw error if note doesn't belong to user", async () => {
			const mockNoteData = {
				id: "note-1",
				user_id: 456,
				app_id: "notes",
				data: '{"title": "Test Note", "content": "Test content"}',
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T00:00:00Z",
			};

			mockRepo.getAppDataById.mockResolvedValue(mockNoteData);

			await expect(
				getNote({ env: mockEnv, userId: 123, noteId: "note-1" }),
			).rejects.toThrow(expect.any(AssistantError));
		});
	});

	describe("createNote", () => {
		it("should create a new note", async () => {
			const mockCreatedEntry = { id: "created-id" };
			const mockFullEntry = {
				id: "created-id",
				data: '{"title": "New Note", "content": "New content"}',
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-01T00:00:00Z",
			};

			mockRepo.createAppDataWithItem.mockResolvedValue(mockCreatedEntry);
			mockRepo.getAppDataById.mockResolvedValue(mockFullEntry);

			const result = await createNote({
				env: mockEnv,
				user: mockUser,
				data: { title: "New Note", content: "New content" },
			});

			expect(result.title).toBe("New Note");
			expect(result.content).toBe("New content");
			expect(mockRepo.createAppDataWithItem).toHaveBeenCalledWith(
				123,
				"notes",
				"test-note-id-123",
				"note",
				{
					title: "New Note",
					content: "New content",
					metadata: {
						contentType: "text",
						keyTopics: ["topic"],
						readingTime: 1,
						sentiment: "neutral",
						summary: "Generated summary",
						tags: ["ai"],
						wordCount: 2,
					},
				},
			);
		});

		it("should throw error if user data is missing", async () => {
			await expect(
				createNote({
					env: mockEnv,
					user: { id: 0 } as any,
					data: { title: "Test", content: "Test" },
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});
	});

	describe("updateNote", () => {
		it("should update existing note", async () => {
			const mockExistingNote = {
				id: "note-1",
				user_id: 123,
				app_id: "notes",
				data: '{"title": "Old Note", "content": "Old content", "metadata": {"summary": "Old summary"}}',
			};
			const mockUpdatedNote = {
				id: "note-1",
				data: '{"title": "Updated Note", "content": "Updated content", "metadata": {"summary": "Old summary"}}',
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-02T00:00:00Z",
			};

			mockRepo.getAppDataById
				.mockResolvedValueOnce(mockExistingNote)
				.mockResolvedValueOnce(mockUpdatedNote);

			const result = await updateNote({
				context: mockContext,
				env: mockEnv,
				user: mockUser,
				noteId: "note-1",
				data: { title: "Updated Note", content: "Updated content" },
			});

			expect(result.title).toBe("Updated Note");
			expect(result.content).toBe("Updated content");
		});

		it("should throw error if note doesn't exist", async () => {
			mockRepo.getAppDataById.mockResolvedValue(null);

			await expect(
				updateNote({
					context: mockContext,
					env: mockEnv,
					user: mockUser,
					noteId: "non-existent",
					data: { title: "Test", content: "Test" },
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should skip metadata regeneration when note already has metadata", async () => {
			const mockExistingNote = {
				id: "note-1",
				user_id: 123,
				app_id: "notes",
				data: JSON.stringify({
					title: "Existing Note",
					content: "Existing content",
					metadata: {
						summary: "Existing summary",
						tags: ["existing"],
						themeMode: "serif",
					},
				}),
			};
			const mockUpdatedNote = {
				id: "note-1",
				data: JSON.stringify({
					title: "Updated Note",
					content: "Updated content",
					metadata: {
						summary: "Existing summary",
						tags: ["existing"],
						themeMode: "sans",
					},
				}),
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-02T00:00:00Z",
			};

			mockRepo.getAppDataById
				.mockResolvedValueOnce(mockExistingNote)
				.mockResolvedValueOnce(mockUpdatedNote);

			const result = await updateNote({
				context: mockContext,
				env: mockEnv,
				user: mockUser,
				noteId: "note-1",
				data: {
					title: "Updated Note",
					content: "Updated content",
					metadata: { themeMode: "sans" },
				},
			});

			expect(getAuxiliaryModel).not.toHaveBeenCalled();
			expect(mockRepo.updateAppData).toHaveBeenCalledWith("note-1", {
				title: "Updated Note",
				content: "Updated content",
				metadata: {
					contentType: "text",
					keyTopics: [],
					wordCount: 2,
					readingTime: 1,
					summary: "Existing summary",
					tags: ["existing"],
					themeMode: "sans",
				},
			});
			expect(result.metadata).toEqual({
				summary: "Existing summary",
				tags: ["existing"],
				themeMode: "sans",
			});
		});

		it("should regenerate metadata when forced", async () => {
			const mockExistingNote = {
				id: "note-1",
				user_id: 123,
				app_id: "notes",
				data: JSON.stringify({
					title: "Existing Note",
					content: "Existing content",
					metadata: {
						summary: "Existing summary",
						tags: ["existing"],
					},
				}),
			};
			const mockUpdatedNote = {
				id: "note-1",
				data: JSON.stringify({
					title: "Updated Note",
					content: "Updated content",
					metadata: {
						contentType: "text",
						keyTopics: ["topic"],
						readingTime: 1,
						sentiment: "neutral",
						summary: "Generated summary",
						tags: ["ai"],
						themeMode: "sans",
						wordCount: 2,
					},
				}),
				created_at: "2023-01-01T00:00:00Z",
				updated_at: "2023-01-02T00:00:00Z",
			};

			mockRepo.getAppDataById
				.mockResolvedValueOnce(mockExistingNote)
				.mockResolvedValueOnce(mockUpdatedNote);

			const result = await updateNote({
				context: mockContext,
				env: mockEnv,
				user: mockUser,
				noteId: "note-1",
				data: {
					title: "Updated Note",
					content: "Updated content",
					metadata: { themeMode: "sans" },
					options: { refreshMetadata: true },
				},
			});

			expect(getAuxiliaryModel).toHaveBeenCalledTimes(1);
			expect(mockRepo.updateAppData).toHaveBeenCalledWith("note-1", {
				title: "Updated Note",
				content: "Updated content",
				metadata: {
					contentType: "text",
					keyTopics: ["topic"],
					readingTime: 1,
					sentiment: "neutral",
					summary: "Generated summary",
					tags: ["ai"],
					themeMode: "sans",
					wordCount: 2,
				},
			});
			expect(result.metadata).toEqual({
				contentType: "text",
				keyTopics: ["topic"],
				readingTime: 1,
				sentiment: "neutral",
				summary: "Generated summary",
				tags: ["ai"],
				themeMode: "sans",
				wordCount: 2,
			});
		});
	});

	describe("deleteNote", () => {
		it("should delete existing note", async () => {
			const mockExistingNote = {
				id: "note-1",
				user_id: 123,
				app_id: "notes",
			};

			mockRepo.getAppDataById.mockResolvedValue(mockExistingNote);

			await deleteNote({
				context: mockContext,
				env: mockEnv,
				user: mockUser,
				noteId: "note-1",
			});

			expect(mockRepo.deleteAppData).toHaveBeenCalledWith("note-1");
		});

		it("should throw error if note doesn't exist", async () => {
			mockRepo.getAppDataById.mockResolvedValue(null);

			await expect(
				deleteNote({
					context: mockContext,
					env: mockEnv,
					user: mockUser,
					noteId: "non-existent",
				}),
			).rejects.toThrow(expect.any(AssistantError));
		});
	});
});
