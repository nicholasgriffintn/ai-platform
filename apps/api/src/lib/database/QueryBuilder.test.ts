import { describe, expect, it } from "vitest";

import { QueryBuilder } from "./QueryBuilder";

describe("QueryBuilder", () => {
	describe("sanitization", () => {
		it("sanitizes table and column identifiers", () => {
			const builder = new QueryBuilder();
			const result = builder
				.select(["id", "user_id"])
				.from("conversation")
				.where("id = ?", ["123"])
				.build();

			expect(result?.query).toBe(
				"SELECT id, user_id FROM conversation WHERE id = ?",
			);
			expect(result?.values).toEqual(["123"]);
		});

		it("allows aggregate functions with aliases", () => {
			const builder = new QueryBuilder();
			const result = builder
				.select(["COUNT(*) AS total"])
				.from("memory_group_members")
				.where("group_id = ?", ["group_1"])
				.build();

			expect(result?.query).toBe(
				"SELECT COUNT(*) AS total FROM memory_group_members WHERE group_id = ?",
			);
			expect(result?.values).toEqual(["group_1"]);
		});

		it("rejects dangerous column identifiers", () => {
			const builder = new QueryBuilder();
			expect(() =>
				builder.select(["id; DROP TABLE users"]).from("user"),
			).toThrowError("Invalid identifier");
		});

		it("rejects dangerous table identifiers", () => {
			const builder = new QueryBuilder();
			expect(() => builder.select().from("user; DROP TABLE users")).toThrowError(
				"Invalid identifier",
			);
		});

		it("rejects unsafe WHERE clauses", () => {
			const builder = new QueryBuilder();
			expect(() =>
				builder.select().from("user").where("id = ?; DROP TABLE users", ["1"]),
			).toThrowError("Invalid WHERE condition");
		});

		it("sanitizes ORDER BY clauses", () => {
			const builder = new QueryBuilder();
			const result = builder
				.select(["id"])
				.from("conversation")
				.orderBy("created_at desc, id ASC")
				.where("user_id = ?", [42])
				.build();

			expect(result?.query).toBe(
				"SELECT id FROM conversation WHERE user_id = ? ORDER BY created_at DESC, id ASC",
			);
			expect(result?.values).toEqual([42]);
		});

		it("rejects unsafe ORDER BY clauses", () => {
			const builder = new QueryBuilder();
			expect(() =>
				builder
					.select(["id"])
					.from("conversation")
					.orderBy("created_at DESC; DROP TABLE conversation"),
			).toThrowError("Invalid ORDER BY segment");
		});

		it("sanitizes RETURNING clauses", () => {
			const builder = new QueryBuilder();
			const result = builder
				.insert("user")
				.values({ id: 1, name: "Alice" })
				.returning("id, name")
				.build();

			expect(result?.query).toBe(
				"INSERT INTO user (id, name) VALUES (?, ?) RETURNING id, name",
			);
		});

		it("rejects unsafe RETURNING clauses", () => {
			const builder = new QueryBuilder();
			expect(() =>
				builder
					.insert("user")
					.values({ id: 1 })
					.returning("id; DROP TABLE user"),
			).toThrowError("Invalid identifier");
		});

		it("accumulates values across multiple where calls", () => {
			const builder = new QueryBuilder();
			const result = builder
				.select(["id"])
				.from("conversation")
				.where("user_id = ?", [1])
				.where("status = ?", ["active"])
				.build();

			expect(result?.query).toBe(
				"SELECT id FROM conversation WHERE user_id = ? AND status = ?",
			);
			expect(result?.values).toEqual([1, "active"]);
		});
	});

	describe("basic UPDATE queries", () => {
		it("should build a simple UPDATE query", () => {
			const builder = new QueryBuilder();
			const updates = { title: "New Title", status: "active" };
			const allowedFields = ["title", "status"];

			const result = builder
				.update("conversation")
				.set(updates, allowedFields)
				.where("id = ?", ["123"])
				.build();

			expect(result).not.toBeNull();
			expect(result?.query).toBe(
				"UPDATE conversation SET title = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
			);
			expect(result?.values).toEqual(["New Title", "active", "123"]);
		});

		it("should filter out undefined fields", () => {
			const builder = new QueryBuilder();
			const updates = { title: "New Title", status: undefined };
			const allowedFields = ["title", "status"];

			const result = builder
				.update("conversation")
				.set(updates, allowedFields)
				.where("id = ?", ["123"])
				.build();

			expect(result?.query).toBe(
				"UPDATE conversation SET title = ?, updated_at = datetime('now') WHERE id = ?",
			);
			expect(result?.values).toEqual(["New Title", "123"]);
		});

		it("should filter out fields not in allowedFields", () => {
			const builder = new QueryBuilder();
			const updates = { title: "New Title", forbidden_field: "hack" };
			const allowedFields = ["title", "status"];

			const result = builder
				.update("conversation")
				.set(updates, allowedFields)
				.where("id = ?", ["123"])
				.build();

			expect(result?.query).toBe(
				"UPDATE conversation SET title = ?, updated_at = datetime('now') WHERE id = ?",
			);
			expect(result?.values).toEqual(["New Title", "123"]);
		});

		it("should return null if no fields to update", () => {
			const builder = new QueryBuilder();
			const updates = { forbidden_field: "value" };
			const allowedFields = ["title", "status"];

			const result = builder
				.update("conversation")
				.set(updates, allowedFields)
				.where("id = ?", ["123"])
				.build();

			expect(result).toBeNull();
		});
	});

	describe("JSON field handling", () => {
		it("should JSON.stringify object fields specified in jsonFields", () => {
			const builder = new QueryBuilder();
			const updates = {
				content: "text",
				tool_calls: [{ id: "1", function: "test" }],
				citations: { source: "doc1" },
			};
			const allowedFields = ["content", "tool_calls", "citations"];

			const result = builder
				.update("message")
				.set(updates, allowedFields, {
					jsonFields: ["tool_calls", "citations"],
				})
				.where("id = ?", ["msg123"])
				.build();

			expect(result?.values).toEqual([
				"text",
				'[{"id":"1","function":"test"}]',
				'{"source":"doc1"}',
				"msg123",
			]);
		});

		it("should handle mixed object types in jsonFields", () => {
			const builder = new QueryBuilder();
			const updates = {
				content: { text: "hello" },
				tool_calls: [{ id: "1" }],
			};
			const allowedFields = ["content", "tool_calls"];

			const result = builder
				.update("message")
				.set(updates, allowedFields, {
					jsonFields: ["content", "tool_calls"],
				})
				.where("id = ?", ["msg123"])
				.build();

			expect(result?.values).toEqual([
				'{"text":"hello"}',
				'[{"id":"1"}]',
				"msg123",
			]);
		});

		it("should not stringify non-object fields even if in jsonFields", () => {
			const builder = new QueryBuilder();
			const updates = {
				content: "plain text",
				tool_calls: null,
			};
			const allowedFields = ["content", "tool_calls"];

			const result = builder
				.update("message")
				.set(updates, allowedFields, {
					jsonFields: ["content", "tool_calls"],
				})
				.where("id = ?", ["msg123"])
				.build();

			expect(result?.values).toEqual(["plain text", null, "msg123"]);
		});
	});

	describe("custom transformer", () => {
		it("should apply custom transformer to field values", () => {
			const builder = new QueryBuilder();
			const updates = { name: "test", count: 5 };
			const allowedFields = ["name", "count"];

			const result = builder
				.update("table")
				.set(updates, allowedFields, {
					transformer: (field, value) => {
						if (field === "count") return Number(value) * 2;
						return value;
					},
				})
				.where("id = ?", ["1"])
				.build();

			expect(result?.values).toEqual(["test", 10, "1"]);
		});

		it("should apply transformer after JSON serialization", () => {
			const builder = new QueryBuilder();
			const updates = { data: { key: "value" } };
			const allowedFields = ["data"];

			const result = builder
				.update("table")
				.set(updates, allowedFields, {
					jsonFields: ["data"],
					transformer: (field, value) => {
						if (field === "data" && typeof value === "string") {
							return value.toUpperCase();
						}
						return value;
					},
				})
				.where("id = ?", ["1"])
				.build();

			expect(result?.values).toEqual(['{"KEY":"VALUE"}', "1"]);
		});
	});

	describe("WHERE clause handling", () => {
		it("should build query without WHERE clause", () => {
			const builder = new QueryBuilder();
			const updates = { title: "New Title" };
			const allowedFields = ["title"];

			const result = builder
				.update("table")
				.set(updates, allowedFields)
				.build();

			expect(result?.query).toBe(
				"UPDATE table SET title = ?, updated_at = datetime('now')",
			);
			expect(result?.values).toEqual(["New Title"]);
		});

		it("should handle multiple WHERE conditions", () => {
			const builder = new QueryBuilder();
			const updates = { status: "active" };
			const allowedFields = ["status"];

			const result = builder
				.update("table")
				.set(updates, allowedFields)
				.where("id = ? AND user_id = ?", ["123", 456])
				.build();

			expect(result?.query).toBe(
				"UPDATE table SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
			);
			expect(result?.values).toEqual(["active", "123", 456]);
		});
	});

	describe("builder reset", () => {
		it("should reset builder state", () => {
			const builder = new QueryBuilder();
			const updates = { title: "Title" };
			const allowedFields = ["title"];

			builder
				.update("table1")
				.set(updates, allowedFields)
				.where("id = ?", ["1"])
				.build();

			builder.reset();

			const result = builder
				.update("table2")
				.set({ name: "Name" }, ["name"])
				.where("id = ?", ["2"])
				.build();

			expect(result?.query).toBe(
				"UPDATE table2 SET name = ?, updated_at = datetime('now') WHERE id = ?",
			);
			expect(result?.values).toEqual(["Name", "2"]);
		});
	});

	describe("real-world repository patterns", () => {
		it("should handle MessageRepository.updateMessage pattern", () => {
			const builder = new QueryBuilder();
			const messageId = "msg_123";
			const updates = {
				content: "Updated content",
				status: "completed",
				tool_calls: [{ id: "tool_1", name: "test" }],
				citations: { source: "doc1" },
			};
			const allowedFields = [
				"content",
				"status",
				"tool_calls",
				"citations",
				"data",
			];

			const result = builder
				.update("message")
				.set(updates, allowedFields, {
					jsonFields: ["tool_calls", "citations", "data"],
					transformer: (field, value) => {
						// Handle content that might be an object
						if (field === "content" && typeof value === "object") {
							return JSON.stringify(value);
						}
						return value;
					},
				})
				.where("id = ?", [messageId])
				.build();

			expect(result).not.toBeNull();
			expect(result?.query).toContain("UPDATE message SET");
			expect(result?.query).toContain("WHERE id = ?");
			expect(result?.values).toContain(messageId);
			expect(result?.values).toContain("Updated content");
			expect(result?.values).toContain("completed");
		});

		it("should handle ConversationRepository.updateConversation pattern", () => {
			const builder = new QueryBuilder();
			const conversationId = "conv_123";
			const updates = {
				title: "New Title",
				is_archived: true,
				last_message_id: "msg_456",
			};
			const allowedFields = [
				"title",
				"is_archived",
				"last_message_id",
				"last_message_at",
				"message_count",
			];

			const result = builder
				.update("conversation")
				.set(updates, allowedFields)
				.where("id = ?", [conversationId])
				.build();

			expect(result?.values).toEqual([
				"New Title",
				true,
				"msg_456",
				"conv_123",
			]);
		});

		it("should handle SharedAgentRepository.updateSharedAgent pattern", () => {
			const builder = new QueryBuilder();
			const sharedAgentId = "agent_123";
			const updates = {
				name: "Updated Agent",
				description: "New description",
				tags: ["tag1", "tag2"],
			};
			const allowedFields = [
				"name",
				"description",
				"avatar_url",
				"category",
				"tags",
			];

			const result = builder
				.update("shared_agents")
				.set(updates, allowedFields, {
					jsonFields: ["tags"],
				})
				.where("id = ?", [sharedAgentId])
				.build();

			expect(result?.values).toEqual([
				"Updated Agent",
				"New description",
				'["tag1","tag2"]',
				"agent_123",
			]);
		});
	});
});
