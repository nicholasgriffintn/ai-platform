import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRepository } from "../ConversationRepository";
import type { IEnv } from "~/types";

const mockDB = {
  prepare: vi.fn(),
};

const mockEnv: IEnv = {
  DB: mockDB as any,
} as IEnv;

describe("ConversationRepository", () => {
  let repository: ConversationRepository;
  let mockStatement: any;
  let mockBound: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockBound = {
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      bind: vi.fn().mockReturnThis(),
    };
    
    mockStatement = {
      bind: vi.fn().mockReturnValue(mockBound),
    };
    
    mockDB.prepare.mockReturnValue(mockStatement);
    repository = new ConversationRepository(mockEnv);
  });

  describe("getUserConversations", () => {
    it("should use optimized query with LEFT JOIN", async () => {
      // Mock count query result
      mockBound.first.mockResolvedValueOnce({ total: 5 });
      
      // Mock conversations query result
      const mockConversations = [
        {
          id: "conv1",
          title: "Test Conversation",
          message_count: 3,
          last_message_at: "2024-01-01T10:00:00Z",
        },
      ];
      mockBound.all.mockResolvedValueOnce({ results: mockConversations });

      const result = await repository.getUserConversations(1, 10, 1, false);

      expect(result).toEqual({
        conversations: mockConversations,
        totalPages: 1,
        pageNumber: 1,
        pageSize: 10,
      });

      // Verify the optimized query structure
      const calls = mockDB.prepare.mock.calls;
      expect(calls).toHaveLength(2);
      
      // Check that the second call (list query) uses LEFT JOIN
      const listQuery = calls[1][0];
      expect(listQuery).toContain("LEFT JOIN message m ON c.id = m.conversation_id");
      expect(listQuery).toContain("COUNT(m.id) as message_count");
      expect(listQuery).toContain("MAX(m.created_at) as last_message_at");
      expect(listQuery).toContain("GROUP BY c.id");
      expect(listQuery).toContain("ORDER BY COALESCE(MAX(m.created_at), c.updated_at) DESC");
    });

    it("should handle archived conversations correctly", async () => {
      mockBound.first.mockResolvedValueOnce({ total: 2 });
      mockBound.all.mockResolvedValueOnce({ results: [] });

      await repository.getUserConversations(1, 10, 1, true);

      const calls = mockDB.prepare.mock.calls;
      
      // Count query should not filter archived
      const countQuery = calls[0][0];
      expect(countQuery).toContain("SELECT COUNT(*) as total FROM conversation WHERE user_id = ?");
      expect(countQuery).not.toContain("is_archived = 0");
      
      // List query should not filter archived
      const listQuery = calls[1][0];
      expect(listQuery).not.toContain("is_archived = 0");
    });

    it("should filter archived conversations when includeArchived is false", async () => {
      mockBound.first.mockResolvedValueOnce({ total: 2 });
      mockBound.all.mockResolvedValueOnce({ results: [] });

      await repository.getUserConversations(1, 10, 1, false);

      const calls = mockDB.prepare.mock.calls;
      
      // Count query should filter archived
      const countQuery = calls[0][0];
      expect(countQuery).toContain("is_archived = 0");
      
      // List query should filter archived
      const listQuery = calls[1][0];
      expect(listQuery).toContain("is_archived = 0");
    });

    it("should calculate pagination correctly", async () => {
      mockBound.first.mockResolvedValueOnce({ total: 25 });
      mockBound.all.mockResolvedValueOnce({ results: [] });

      const result = await repository.getUserConversations(1, 10, 3, false);

      expect(result.totalPages).toBe(3); // 25 / 10 = 2.5 -> 3
      expect(result.pageNumber).toBe(3);
      expect(result.pageSize).toBe(10);

      // Verify offset calculation (page 3 with limit 10 should have offset 20)
      expect(mockStatement.bind).toHaveBeenLastCalledWith(1, 10, 20);
    });

    it("should handle empty results", async () => {
      mockBound.first.mockResolvedValueOnce({ total: 0 });
      mockBound.all.mockResolvedValueOnce({ results: [] });

      const result = await repository.getUserConversations(1, 10, 1, false);

      expect(result).toEqual({
        conversations: [],
        totalPages: 0,
        pageNumber: 1,
        pageSize: 10,
      });
    });

    it("should handle null count result", async () => {
      mockBound.first.mockResolvedValueOnce(null);
      mockBound.all.mockResolvedValueOnce({ results: [] });

      const result = await repository.getUserConversations(1, 10, 1, false);

      expect(result.totalPages).toBe(0);
    });

    it("should use correct parameters for queries", async () => {
      mockBound.first.mockResolvedValueOnce({ total: 1 });
      mockBound.all.mockResolvedValueOnce({ results: [] });

      await repository.getUserConversations(123, 5, 2, false);

      // Count query parameters
      expect(mockStatement.bind).toHaveBeenNthCalledWith(1, 123);
      
      // List query parameters: userId, limit, offset
      expect(mockStatement.bind).toHaveBeenNthCalledWith(2, 123, 5, 5); // offset = (2-1) * 5 = 5
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockBound.first.mockRejectedValueOnce(new Error("Database error"));

      await expect(repository.getUserConversations(1, 10, 1, false))
        .rejects.toThrow("Error executing database query: Database error");
    });
  });
});