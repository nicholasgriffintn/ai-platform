import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { Database } from "../index";

describe("Database", () => {
	let mockEnv: any;

	beforeEach(() => {
		vi.clearAllMocks();

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

	describe("instance creation", () => {
		it("should return a new instance when called multiple times", () => {
			const instance1 = Database.getInstance(mockEnv);
			const instance2 = Database.getInstance(mockEnv);

			expect(instance1).not.toBe(instance2);
			expect(instance1).toBeInstanceOf(Database);
			expect(instance2).toBeInstanceOf(Database);
		});

		it("should keep repositories scoped to the instance", () => {
			const instance1 = Database.getInstance(mockEnv);
			const instance2 = Database.getInstance(mockEnv);

			expect((instance1 as any).repositories).not.toBe(
				(instance2 as any).repositories,
			);
		});
	});

	describe("environment handling", () => {
		it("should use the provided environment for each instance", () => {
			const env1 = { ...mockEnv, extraProp: "value1" };
			const env2 = { ...mockEnv, extraProp: "value2" };

			const instance1 = Database.getInstance(env1);
			const instance2 = Database.getInstance(env2);

			expect((instance1 as any).env.extraProp).toBe("value1");
			expect((instance2 as any).env.extraProp).toBe("value2");
		});

		it("should throw error if first env is invalid", () => {
			// @ts-ignore - this is a test
			expect(() => Database.getInstance({})).toThrow(AssistantError);
			// @ts-ignore - this is a test
			expect(() => Database.getInstance({})).toThrow("Database not configured");
		});
	});

	describe("instance methods", () => {
		let database: Database;

		beforeEach(() => {
			database = Database.getInstance(mockEnv);
		});

		it("should have repositories getter", () => {
			expect(database.repositories).toBeDefined();
			expect(database.repositories).toBeInstanceOf(Object);
		});

		it("should have connection getter", () => {
			expect(database.connection).toBeDefined();
			expect(database.connection).toBe(mockEnv.DB);
		});

		it("should have complex business logic methods", () => {
			expect(database.createUser).toBeDefined();
			expect(database.consumeMagicLinkNonce).toBeDefined();
			expect(database.deleteAllChatCompletions).toBeDefined();
		});

		it("should have user repository methods accessible", () => {
			expect(database.repositories.users).toBeDefined();
			expect(database.repositories.users.getUserById).toBeDefined();
			expect(database.repositories.users.getUserByGithubId).toBeDefined();
			expect(database.repositories.users.getUserBySessionId).toBeDefined();
			expect(database.repositories.users.createUser).toBeDefined();
			expect(database.repositories.users.updateUser).toBeDefined();
		});

		it("should have conversation repository methods accessible", () => {
			expect(database.repositories.conversations).toBeDefined();
			expect(database.repositories.conversations.createConversation).toBeDefined();
			expect(database.repositories.conversations.getConversation).toBeDefined();
			expect(
				database.repositories.conversations.getUserConversations,
			).toBeDefined();
			expect(
				database.repositories.conversations.updateConversation,
			).toBeDefined();
			expect(
				database.repositories.conversations.deleteConversation,
			).toBeDefined();
		});

		it("should have message repository methods accessible", () => {
			expect(database.repositories.messages).toBeDefined();
			expect(database.repositories.messages.createMessage).toBeDefined();
			expect(database.repositories.messages.getMessage).toBeDefined();
			expect(
				database.repositories.messages.getConversationMessages,
			).toBeDefined();
			expect(database.repositories.messages.updateMessage).toBeDefined();
			expect(database.repositories.messages.deleteMessage).toBeDefined();
		});
	});
});
