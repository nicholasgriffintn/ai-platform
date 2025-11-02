import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatOrchestrator } from "~/lib/chat/core/ChatOrchestrator";
import type { CoreChatOptions, Message } from "~/types";
import {
	delegateToTeamMember,
	delegateToTeamMemberByRole,
} from "../teamDelegation";

const {
	mockValidator,
	mockPreparer,
	mockGuardrails,
	mockConversationManager,
	mockGetAIResponse,
	mockAgentRepository,
	mockTeamDelegation,
	mockHandleToolCalls,
} = vi.hoisted(() => ({
	mockValidator: {
		validate: vi.fn(),
	},
	mockPreparer: {
		prepare: vi.fn(),
	},
	mockGuardrails: {
		validateOutput: vi.fn(),
	},
	mockConversationManager: {
		checkUsageLimits: vi.fn(),
		add: vi.fn(),
	},
	mockGetAIResponse: vi.fn(),
	mockAgentRepository: {
		getAgentById: vi.fn(),
	},
	mockTeamDelegation: {
		callAgent: vi.fn(),
		findAgentByRole: vi.fn(),
	},
	mockHandleToolCalls: vi.fn(),
}));

vi.mock("~/lib/chat/validation/ValidationPipeline", () => ({
	ValidationPipeline: vi.fn(() => mockValidator),
}));

vi.mock("~/lib/chat/preparation/RequestPreparer", () => ({
	RequestPreparer: vi.fn(() => mockPreparer),
}));

vi.mock("~/lib/chat/responses", () => ({
	getAIResponse: mockGetAIResponse,
}));

vi.mock("~/lib/guardrails", () => ({
	Guardrails: vi.fn(() => mockGuardrails),
}));

vi.mock("~/repositories/AgentRepository", () => ({
	AgentRepository: vi.fn(() => mockAgentRepository),
}));

vi.mock("~/lib/agents/team/TeamDelegation", () => ({
	TeamDelegation: vi.fn(() => mockTeamDelegation),
}));

vi.mock("~/lib/chat/tools", () => ({
	handleToolCalls: mockHandleToolCalls,
}));

vi.mock("~/utils/id", () => ({
	generateId: () => "test-id",
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

describe("Team Delegation Integration", () => {
	let orchestrator: ChatOrchestrator;
	let mockEnv: any;
	let mockUser: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = { AI: { aiGatewayLogId: "test-log-id" } };
		mockUser = { id: "user-123" };
		orchestrator = new ChatOrchestrator(mockEnv);

		mockValidator.validate.mockResolvedValue({
			validation: { isValid: true },
			context: { modelConfig: { matchingModel: "test-model" } },
		});

		mockPreparer.prepare.mockResolvedValue({
			modelConfigs: [{ model: "test-model" }],
			primaryModel: "test-model",
			primaryProvider: "test-provider",
			conversationManager: mockConversationManager,
			messages: [{ role: "user", content: "Hello" }],
			systemPrompt: "Test system prompt",
			messageWithContext: "Hello with context",
			userSettings: {},
			currentMode: "chat",
		});

		mockConversationManager.checkUsageLimits.mockResolvedValue(undefined);
		mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
		mockConversationManager.add.mockResolvedValue(undefined);
	});

	describe("delegate_to_team_member function execution", () => {
		it("should successfully execute delegation when agent context is available", async () => {
			const mockCurrentAgent = {
				id: "agent-123",
				name: "Test Agent",
				user_id: "user-123",
			};

			const mockTargetAgent = {
				id: "agent-456",
				name: "Target Agent",
				user_id: "user-123",
			};

			const mockDelegationResponse: Message[] = [
				{
					role: "assistant",
					content: "Task completed successfully",
				},
			];

			mockAgentRepository.getAgentById
				.mockResolvedValueOnce(mockCurrentAgent)
				.mockResolvedValueOnce(mockTargetAgent);
			mockTeamDelegation.callAgent.mockResolvedValue(mockDelegationResponse);

			const mockRequest = {
				env: mockEnv,
				user: mockUser,
				request: {
					completion_id: "test-completion-id",
					input: "Test task",
					model: "test-model",
					date: "2024-01-01",
					current_agent_id: "agent-123",
					delegation_stack: [],
					max_delegation_depth: 3,
				},
				app_url: "https://test.com",
			};

			const result = await delegateToTeamMember.function(
				"test-completion-id",
				{
					agent_id: "agent-456",
					task_description: "Please complete this task",
				},
				mockRequest as any,
			);

			expect(result).toEqual({
				status: "success",
				content: "Task completed successfully",
				role: "tool",
			});

			expect(mockAgentRepository.getAgentById).toHaveBeenCalledWith(
				"agent-123",
			);
			expect(mockAgentRepository.getAgentById).toHaveBeenCalledWith(
				"agent-456",
			);
			expect(mockTeamDelegation.callAgent).toHaveBeenCalledWith("agent-456", [
				{ role: "user", content: "Please complete this task" },
			]);
		});

		it("should fail when current_agent_id is missing", async () => {
			const mockRequest = {
				env: mockEnv,
				user: mockUser,
				request: {
					completion_id: "test-completion-id",
					input: "Test task",
					model: "test-model",
					date: "2024-01-01",
				},
				app_url: "https://test.com",
			};

			const result = await delegateToTeamMember.function(
				"test-completion-id",
				{
					agent_id: "agent-456",
					task_description: "Please complete this task",
				},
				mockRequest as any,
			);

			expect(result).toEqual({
				status: "error",
				content: "Current agent context not available for team delegation",
				role: "tool",
			});
		});
	});

	describe("delegate_to_team_member_by_role function execution", () => {
		it("should successfully execute delegation by role when agent context is available", async () => {
			const mockCurrentAgent = {
				id: "agent-123",
				name: "Test Agent",
				user_id: "user-123",
			};

			const mockTargetAgent = {
				id: "agent-456",
				name: "Specialist Agent",
				user_id: "user-123",
				team_role: "specialist",
			};

			const mockDelegationResponse: Message[] = [
				{
					role: "assistant",
					content: "Specialist task completed",
				},
			];

			mockAgentRepository.getAgentById
				.mockResolvedValueOnce(mockCurrentAgent)
				.mockResolvedValueOnce(mockTargetAgent)
				.mockResolvedValueOnce(mockCurrentAgent)
				.mockResolvedValueOnce(mockTargetAgent);
			mockTeamDelegation.findAgentByRole.mockResolvedValue(mockTargetAgent);
			mockTeamDelegation.callAgent.mockResolvedValue(mockDelegationResponse);

			const mockRequest = {
				env: mockEnv,
				user: mockUser,
				request: {
					completion_id: "test-completion-id",
					input: "Test task",
					model: "test-model",
					date: "2024-01-01",
					current_agent_id: "agent-123",
					delegation_stack: [],
					max_delegation_depth: 3,
				},
				app_url: "https://test.com",
			};

			const result = await delegateToTeamMemberByRole.function(
				"test-completion-id",
				{
					role: "specialist",
					task_description: "Please handle this specialized task",
				},
				mockRequest as any,
			);

			expect(result).toEqual({
				status: "success",
				content: "Specialist task completed",
				role: "tool",
			});

			expect(mockTeamDelegation.findAgentByRole).toHaveBeenCalledWith(
				"specialist",
			);
		});

		it("should fail when current_agent_id is missing", async () => {
			const mockRequest = {
				env: mockEnv,
				user: mockUser,
				request: {
					completion_id: "test-completion-id",
					input: "Test task",
					model: "test-model",
					date: "2024-01-01",
				},
				app_url: "https://test.com",
			};

			const result = await delegateToTeamMemberByRole.function(
				"test-completion-id",
				{
					role: "specialist",
					task_description: "Please handle this specialized task",
				},
				mockRequest as any,
			);

			expect(result).toEqual({
				status: "error",
				content: "Current agent context not available for team delegation",
				role: "tool",
			});
		});
	});

	describe("Full chat completion to delegation workflow", () => {
		it("should complete delegation workflow from chat completion request", async () => {
			const mockResponse = {
				response: "I'll delegate this task to a specialist.",
				tool_calls: [
					{
						id: "call-1",
						type: "function",
						function: {
							name: "delegate_to_team_member",
							arguments: JSON.stringify({
								agent_id: "agent-456",
								task_description: "Handle this complex task",
							}),
						},
					},
				],
				usage: { total_tokens: 150 },
			};

			const mockCurrentAgent = {
				id: "agent-123",
				name: "Main Agent",
				user_id: "user-123",
			};

			const mockTargetAgent = {
				id: "agent-456",
				name: "Specialist Agent",
				user_id: "user-123",
			};

			const mockDelegationResponse: Message[] = [
				{
					role: "assistant",
					content: "Task handled by specialist",
				},
			];

			mockGetAIResponse.mockResolvedValue(mockResponse);
			mockAgentRepository.getAgentById
				.mockResolvedValueOnce(mockCurrentAgent)
				.mockResolvedValueOnce(mockTargetAgent);
			mockTeamDelegation.callAgent.mockResolvedValue(mockDelegationResponse);
			mockHandleToolCalls.mockResolvedValue([
				{
					role: "tool",
					content: "Task handled by specialist",
					tool_call_id: "call-1",
				},
			]);

			const options: CoreChatOptions = {
				completion_id: "test-completion-id",
				model: "test-model",
				messages: [
					{ role: "user", content: "Please handle this complex task" },
				],
				user: mockUser,
				env: mockEnv,
				app_url: "https://test.com",
				current_agent_id: "agent-123",
				delegation_stack: [],
				max_delegation_depth: 3,
				tools: [
					{
						type: "function",
						function: {
							name: "delegate_to_team_member",
							description: delegateToTeamMember.description,
							parameters: delegateToTeamMember.parameters,
						},
					},
				],
			};

			const result = await orchestrator.process(options);

			expect(result).toEqual(
				expect.objectContaining({
					response: mockResponse,
					toolResponses: [
						{
							role: "tool",
							content: "Task handled by specialist",
							tool_call_id: "call-1",
						},
					],
					selectedModel: "test-model",
					completion_id: "test-completion-id",
				}),
			);

			expect(mockHandleToolCalls).toHaveBeenCalledWith(
				"test-completion-id",
				mockResponse,
				mockConversationManager,
				expect.objectContaining({
					request: expect.objectContaining({
						current_agent_id: "agent-123",
						delegation_stack: [],
						max_delegation_depth: 3,
					}),
				}),
			);
		});

		it("should fail gracefully when delegation context is missing from chat completion", async () => {
			const mockResponse = {
				response: "I'll try to delegate this task.",
				tool_calls: [
					{
						id: "call-1",
						type: "function",
						function: {
							name: "delegate_to_team_member",
							arguments: JSON.stringify({
								agent_id: "agent-456",
								task_description: "Handle this task",
							}),
						},
					},
				],
				usage: { total_tokens: 100 },
			};

			mockGetAIResponse.mockResolvedValue(mockResponse);
			mockHandleToolCalls.mockResolvedValue([
				{
					role: "tool",
					content: "Current agent context not available for team delegation",
					tool_call_id: "call-1",
				},
			]);

			const options: CoreChatOptions = {
				completion_id: "test-completion-id",
				model: "test-model",
				messages: [{ role: "user", content: "Please handle this task" }],
				user: mockUser,
				env: mockEnv,
				app_url: "https://test.com",
				tools: [
					{
						type: "function",
						function: {
							name: "delegate_to_team_member",
							description: delegateToTeamMember.description,
							parameters: delegateToTeamMember.parameters,
						},
					},
				],
			};

			const result = await orchestrator.process(options);

			expect(result).toEqual(
				expect.objectContaining({
					response: mockResponse,
					toolResponses: [
						{
							role: "tool",
							content:
								"Current agent context not available for team delegation",
							tool_call_id: "call-1",
						},
					],
					selectedModel: "test-model",
					completion_id: "test-completion-id",
				}),
			);
		});
	});
});
