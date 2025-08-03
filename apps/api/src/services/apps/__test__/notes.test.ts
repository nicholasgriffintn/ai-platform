import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "../notes";

const mockRepo = {
  getAppDataByUserAndApp: vi.fn(),
  getAppDataById: vi.fn(),
  createAppDataWithItem: vi.fn(),
  updateAppData: vi.fn(),
  deleteAppData: vi.fn(),
};

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => ({ appData: mockRepo })),
  },
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "test-note-id-123"),
}));

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
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

  beforeEach(() => {
    vi.clearAllMocks();
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
      ).rejects.toThrow(AssistantError);
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
      ).rejects.toThrow(AssistantError);
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
            keyTopics: [],
            readingTime: 1,
            summary: "New content",
            tags: [],
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
      ).rejects.toThrow(AssistantError);
    });
  });

  describe("updateNote", () => {
    it("should update existing note", async () => {
      const mockExistingNote = {
        id: "note-1",
        user_id: 123,
        app_id: "notes",
      };
      const mockUpdatedNote = {
        id: "note-1",
        data: '{"title": "Updated Note", "content": "Updated content"}',
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-02T00:00:00Z",
      };

      mockRepo.getAppDataById
        .mockResolvedValueOnce(mockExistingNote)
        .mockResolvedValueOnce(mockUpdatedNote);

      const result = await updateNote({
        env: mockEnv,
        userId: 123,
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
          env: mockEnv,
          userId: 123,
          noteId: "non-existent",
          data: { title: "Test", content: "Test" },
        }),
      ).rejects.toThrow(AssistantError);
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

      await deleteNote({ env: mockEnv, userId: 123, noteId: "note-1" });

      expect(mockRepo.deleteAppData).toHaveBeenCalledWith("note-1");
    });

    it("should throw error if note doesn't exist", async () => {
      mockRepo.getAppDataById.mockResolvedValue(null);

      await expect(
        deleteNote({ env: mockEnv, userId: 123, noteId: "non-existent" }),
      ).rejects.toThrow(AssistantError);
    });
  });
});
