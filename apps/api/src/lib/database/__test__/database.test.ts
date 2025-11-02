import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { Database } from "../index";

describe("Database", () => {
	let mockEnv: any;

	beforeEach(() => {
		vi.clearAllMocks();

		(Database as any).instance = undefined;

		mockEnv = {
			DB: {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						all: vi.fn().mockResolvedValue({ results: [] }),
						first: vi.fn().mockResolvedValue(null),
						run: vi.fn().mockResolvedValue({ success: true }),
					}),
				}),
				exec: vi.fn().mockResolvedValue({ results: [] }),
			},
		};
	});

	describe("constructor", () => {
		it("should throw error when DB is not configured", () => {
			// @ts-ignore - this is a test
			expect(() => new Database({})).toThrow(AssistantError);
			// @ts-ignore - this is a test
			expect(() => new Database({})).toThrow("Database not configured");
		});

		it("should create instance when DB is configured", () => {
			expect(() => new Database(mockEnv)).not.toThrow();
		});
	});

	describe("singleton behavior", () => {
		it("should return the same instance when called multiple times", () => {
			const instance1 = Database.getInstance(mockEnv);
			const instance2 = Database.getInstance(mockEnv);

			expect(instance1).toBe(instance2);
			expect(instance1).toBeInstanceOf(Database);
		});

		it("should ignore different env parameters after first initialization", () => {
			const env1 = { ...mockEnv, extraProp: "value1" };
			const env2 = { ...mockEnv, extraProp: "value2" };

			const instance1 = Database.getInstance(env1);
			const instance2 = Database.getInstance(env2);

			expect(instance1).toBe(instance2);
			expect((instance1 as any).env.extraProp).toBe("value1");
		});

		it("should maintain singleton across different call patterns", () => {
			const instance1 = Database.getInstance(mockEnv);

			// Simulate multiple service calls
			const instance2 = Database.getInstance(mockEnv);
			const instance3 = Database.getInstance({ ...mockEnv });

			expect(instance1).toBe(instance2);
			expect(instance2).toBe(instance3);
		});

		it("should share the same repositories instance", () => {
			const instance1 = Database.getInstance(mockEnv);
			const instance2 = Database.getInstance(mockEnv);

			expect((instance1 as any).repositories).toBe(
				(instance2 as any).repositories,
			);
		});
	});

	describe("environment handling", () => {
		it("should use the first environment provided", () => {
			const env1 = { ...mockEnv, testValue: "first" };
			const env2 = { ...mockEnv, testValue: "second" };

			const instance1 = Database.getInstance(env1);
			const instance2 = Database.getInstance(env2);

			expect((instance1 as any).env.testValue).toBe("first");
			expect((instance2 as any).env.testValue).toBe("first");
		});

		it("should throw error if first env is invalid", () => {
			// @ts-ignore - this is a test
			expect(() => Database.getInstance({})).toThrow(AssistantError);
			// @ts-ignore - this is a test
			expect(() => Database.getInstance({})).toThrow("Database not configured");
		});

		it("should not create new instance even if subsequent env is invalid", () => {
			const validEnv = mockEnv;
			const invalidEnv = {};

			const instance1 = Database.getInstance(validEnv);
			// @ts-ignore - this is a test
			const instance2 = Database.getInstance(invalidEnv);

			expect(instance1).toBe(instance2);
			expect(instance1).toBeInstanceOf(Database);
		});
	});

	describe("instance methods", () => {
		let database: Database;

		beforeEach(() => {
			database = Database.getInstance(mockEnv);
		});

		it("should have all expected user methods", () => {
			expect(database.getUserByGithubId).toBeDefined();
			expect(database.getUserBySessionId).toBeDefined();
			expect(database.getUserById).toBeDefined();
			expect(database.createUser).toBeDefined();
			expect(database.updateUser).toBeDefined();
		});

		it("should have all expected conversation methods", () => {
			expect(database.createConversation).toBeDefined();
			expect(database.getConversation).toBeDefined();
			expect(database.getUserConversations).toBeDefined();
			expect(database.updateConversation).toBeDefined();
			expect(database.deleteConversation).toBeDefined();
		});

		it("should have all expected message methods", () => {
			expect(database.createMessage).toBeDefined();
			expect(database.getMessage).toBeDefined();
			expect(database.getConversationMessages).toBeDefined();
			expect(database.updateMessage).toBeDefined();
			expect(database.deleteMessage).toBeDefined();
		});
	});
});
