import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock,
} from "vitest";

import { handleCheckChatCompletion } from "../checkChatCompletion";

vi.mock("~/lib/context/serviceContext", () => ({
	resolveServiceContext: vi.fn(),
}));

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/lib/guardrails", () => ({
	Guardrails: vi.fn(),
}));

const mockEnv = {
	DB: "test-db",
} as any;

const mockUser = {
	id: "user-123",
	email: "test@example.com",
} as any;

const mockRequest = {
	env: mockEnv,
	user: mockUser,
} as any;

let mockServiceContext: any;
let resolveServiceContext: any;

describe("handleCheckChatCompletion", () => {
	let mockDatabase: any;
	let mockConversationManager: any;
	let mockGuardrails: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
		const { ConversationManager } = await import("~/lib/conversationManager");
		const { Guardrails } = await import("~/lib/guardrails");

		mockDatabase = {
			getUserSettings: vi.fn(),
		};

		mockConversationManager = {
			get: vi.fn(),
		};

		mockGuardrails = {
			validateInput: vi.fn(),
			validateOutput: vi.fn(),
		};

		mockServiceContext = {
			env: mockEnv,
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: mockDatabase,
			repositories: {
				userSettings: {
					getUserSettings: mockDatabase.getUserSettings,
				},
			} as any,
		};

		vi.mocked(resolveServiceContext).mockReturnValue(mockServiceContext);
		vi.mocked(ConversationManager.getInstance).mockReturnValue(
			mockConversationManager,
		);
		(Guardrails as unknown as Mock).mockImplementation(() => mockGuardrails);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing user ID", async () => {
			const requestWithoutUser = {
				env: mockEnv,
				user: null,
			} as any;

			await expect(() =>
				handleCheckChatCompletion(requestWithoutUser, "completion-123", "user"),
			).rejects.toThrow("Authentication required");
		});

		it("should throw error for user without ID", async () => {
			const requestWithInvalidUser = {
				env: mockEnv,
				user: { email: "test@example.com" },
			} as any;

			await expect(() =>
				handleCheckChatCompletion(
					requestWithInvalidUser,
					"completion-123",
					"user",
				),
			).rejects.toThrow("Authentication required");
		});

		it("should surface errors from service context creation", async () => {
			const requestWithoutDB = {
				env: {},
				user: mockUser,
			} as any;

			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleCheckChatCompletion(requestWithoutDB, "completion-123", "user"),
			).rejects.toThrow("Database not configured");
		});

		it("should throw error for missing completion_id", async () => {
			await expect(() =>
				handleCheckChatCompletion(mockRequest, "", "user"),
			).rejects.toThrow("Missing completion_id or role");
		});

		it("should throw error for missing role", async () => {
			await expect(() =>
				handleCheckChatCompletion(mockRequest, "completion-123", ""),
			).rejects.toThrow("Missing completion_id or role");
		});
	});

	describe("successful validation", () => {
		it("should validate user input successfully", async () => {
			const completionId = "completion-123";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Hello, how are you?",
					status: "completed",
				},
				{
					id: "msg-2",
					role: "assistant",
					content: "I'm doing well, thank you!",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.95,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);
			mockDatabase.getUserSettings.mockResolvedValue({});

			const result = await handleCheckChatCompletion(
				mockRequest,
				completionId,
				"user",
			);

			expect(mockConversationManager.get).toHaveBeenCalledWith(completionId);
			expect(mockDatabase.getUserSettings).toHaveBeenCalledWith("user-123");
			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				expect.stringContaining("user: Hello, how are you?"),
				"user-123",
				completionId,
			);
			expect(result).toEqual({
				content: "Input is valid",
				data: mockValidation,
			});
		});

		it("should validate assistant output successfully", async () => {
			const completionId = "completion-456";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Tell me a joke",
					status: "completed",
				},
				{
					id: "msg-2",
					role: "assistant",
					content: "Why did the chicken cross the road?",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.98,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateOutput.mockResolvedValue(mockValidation);

			const result = await handleCheckChatCompletion(
				mockRequest,
				completionId,
				"assistant",
			);

			expect(mockGuardrails.validateOutput).toHaveBeenCalledWith(
				expect.stringContaining(
					"assistant: Why did the chicken cross the road?",
				),
				"user-123",
				completionId,
			);
			expect(result).toEqual({
				content: "Output is valid",
				data: mockValidation,
			});
		});

		it("should handle invalid user input", async () => {
			const completionId = "completion-invalid";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Inappropriate content here",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: false,
				score: 0.15,
				flags: ["inappropriate_content"],
				reason: "Content violates community guidelines",
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);

			const result = await handleCheckChatCompletion(
				mockRequest,
				completionId,
				"user",
			);

			expect(result).toEqual({
				content: "Input is not valid",
				data: mockValidation,
			});
		});

		it("should handle invalid assistant output", async () => {
			const completionId = "completion-invalid-output";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Hello",
					status: "completed",
				},
				{
					id: "msg-2",
					role: "assistant",
					content: "Inappropriate response",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: false,
				score: 0.25,
				flags: ["policy_violation"],
				reason: "Response violates content policy",
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateOutput.mockResolvedValue(mockValidation);

			const result = await handleCheckChatCompletion(
				mockRequest,
				completionId,
				"assistant",
			);

			expect(result).toEqual({
				content: "Output is not valid",
				data: mockValidation,
			});
		});
	});

	describe("message filtering", () => {
		it("should filter out error messages", async () => {
			const completionId = "completion-with-errors";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Valid message",
					status: "completed",
				},
				{
					id: "msg-2",
					role: "assistant",
					content: "Error occurred",
					status: "error",
				},
				{
					id: "msg-3",
					role: "user",
					content: "Another valid message",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.9,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);

			await handleCheckChatCompletion(mockRequest, completionId, "user");

			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				expect.not.stringContaining("Error occurred"),
				"user-123",
				completionId,
			);
		});

		it("should filter out messages without content", async () => {
			const completionId = "completion-no-content";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Valid message",
					status: "completed",
				},
				{
					id: "msg-2",
					role: "assistant",
					content: null,
					status: "completed",
				},
				{
					id: "msg-3",
					role: "user",
					content: "",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.95,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);

			await handleCheckChatCompletion(mockRequest, completionId, "user");

			const calledWith = mockGuardrails.validateInput.mock.calls[0][0];
			expect(calledWith).not.toContain("null");
			expect(calledWith).toContain("user: Valid message");
		});

		it("should handle complex message content", async () => {
			const completionId = "completion-complex";
			const complexContent = {
				type: "analysis",
				data: { result: "test" },
				summary: "Complex analysis result",
			};

			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: complexContent,
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.92,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);

			await handleCheckChatCompletion(mockRequest, completionId, "user");

			expect(mockGuardrails.validateInput).toHaveBeenCalledWith(
				expect.stringContaining(JSON.stringify(complexContent)),
				"user-123",
				completionId,
			);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found", async () => {
			const completionId = "nonexistent-completion";

			mockConversationManager.get.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleCheckChatCompletion(mockRequest, completionId, "user"),
			).rejects.toThrow(
				"Conversation not found or you don't have access to it",
			);
		});

		it("should handle empty conversation", async () => {
			const completionId = "empty-completion";

			mockConversationManager.get.mockResolvedValue([]);

			await expect(() =>
				handleCheckChatCompletion(mockRequest, completionId, "user"),
			).rejects.toThrow("No messages found");
		});

		it("should handle guardrails validation errors", async () => {
			const completionId = "completion-guardrails-error";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Test message",
					status: "completed",
				},
			];

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockRejectedValue(
				new Error("Guardrails service unavailable"),
			);

			await expect(() =>
				handleCheckChatCompletion(mockRequest, completionId, "user"),
			).rejects.toThrow("Guardrails service unavailable");
		});

		it("should handle user settings retrieval errors", async () => {
			const completionId = "completion-settings-error";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Test message",
					status: "completed",
				},
			];

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockDatabase.getUserSettings.mockRejectedValue(
				new Error("Settings retrieval failed"),
			);

			await expect(() =>
				handleCheckChatCompletion(mockRequest, completionId, "user"),
			).rejects.toThrow("Settings retrieval failed");
		});
	});

	describe("role validation", () => {
		it("should default to user role when role is empty", async () => {
			const completionId = "completion-default-role";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Test message",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.95,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateInput.mockResolvedValue(mockValidation);

			await expect(() =>
				handleCheckChatCompletion(mockRequest, completionId, ""),
			).rejects.toThrow("Missing completion_id or role");
		});

		it("should handle different role types", async () => {
			const completionId = "completion-role-types";
			const mockMessages = [
				{
					id: "msg-1",
					role: "system",
					content: "System message",
					status: "completed",
				},
			];

			const mockValidation = {
				isValid: true,
				score: 0.95,
				flags: [],
			};

			mockConversationManager.get.mockResolvedValue(mockMessages);
			mockGuardrails.validateOutput.mockResolvedValue(mockValidation);

			const result = await handleCheckChatCompletion(
				mockRequest,
				completionId,
				"system",
			);

			expect(mockGuardrails.validateOutput).toHaveBeenCalledWith(
				expect.stringContaining("system: System message"),
				"user-123",
				completionId,
			);
			expect(result.content).toBe("Output is valid");
		});
	});
});
