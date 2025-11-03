import { TeamDelegation } from "~/lib/agents/team/TeamDelegation";
import {
	resolveServiceContext,
	createServiceContext,
} from "~/lib/context/serviceContext";
import type { IFunction, IFunctionResponse, IRequest, Message } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/teamDelegation" });

export const delegateToTeamMember: IFunction = {
	name: "delegate_to_team_member",
	description:
		"Call a specific team member agent to handle a task. Use this when you need specialized expertise from your team.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			agent_id: {
				type: "string",
				description: "The ID of the team member agent to call",
			},
			task_description: {
				type: "string",
				description:
					"Description of the task you're delegating to the team member",
			},
			context_messages: {
				type: "array",
				description:
					"Messages to provide as context to the team member (optional)",
			},
		},
		required: ["agent_id", "task_description"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
	): Promise<IFunctionResponse> => {
		try {
			const serviceContext = resolveServiceContext({
				context: req.context,
				env: req.env,
				user: req.user ?? null,
			});
			serviceContext.ensureDatabase();
			const agentRepository = serviceContext.repositories.agents;

			const currentAgentId = req.request.current_agent_id;

			if (!currentAgentId) {
				logger.error("Delegation failed - no current_agent_id", {
					completion_id,
				});
				return {
					status: "error",
					content: "Current agent context not available for team delegation",
					role: "tool",
				};
			}

			const currentAgent = await agentRepository.getAgentById(currentAgentId);

			if (!currentAgent) {
				return {
					status: "error",
					content: "Current agent not found",
					role: "tool",
				};
			}

			const targetAgent = await agentRepository.getAgentById(args.agent_id);

			if (!targetAgent) {
				return {
					status: "error",
					content: `Team delegation failed: Target agent '${args.agent_id}' not found. Please verify the agent ID is correct.`,
					role: "tool",
				};
			}

			if (targetAgent.user_id !== req.user?.id) {
				return {
					status: "error",
					content: `Team delegation failed: Access denied to agent '${targetAgent.name}' (${args.agent_id}). You can only delegate to agents you own.`,
					role: "tool",
				};
			}

			const delegation = new TeamDelegation({
				env: req.env,
				user: req.user,
				currentAgent,
				delegationStack: req.request.delegation_stack,
				maxDelegationDepth: req.request.max_delegation_depth,
				rateLimitWindowMs: 60000,
				maxDelegationsPerWindow: 10,
			});

			const messages: Message[] = [
				{
					role: "user",
					content: args.task_description,
				},
			];

			if (args.context_messages && Array.isArray(args.context_messages)) {
				const contextMessages: Message[] = args.context_messages.map(
					(msg: any) => ({
						role: msg.role as any,
						content: msg.content,
					}),
				);
				messages.unshift(...contextMessages);
			}

			logger.info(
				`Delegating task to agent ${args.agent_id}: ${args.task_description}`,
			);

			const results = await delegation.callAgent(args.agent_id, messages);

			if (results.length === 0) {
				return {
					status: "success",
					content: "Team member did not provide a response.",
					role: "tool",
				};
			}

			const response = results
				.filter((msg) => msg.role === "assistant")
				.map((msg) =>
					typeof msg.content === "string"
						? msg.content
						: JSON.stringify(msg.content),
				)
				.join("\n\n");

			return {
				status: "success",
				content:
					response ||
					"Team member completed the task but provided no detailed response.",
				role: "tool",
			};
		} catch (error) {
			logger.error("Team delegation failed:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			return {
				status: "error",
				content: `Failed to delegate to team member: ${error}`,
				role: "tool",
			};
		}
	},
};

export const delegateToTeamMemberByRole: IFunction = {
	name: "delegate_to_team_member_by_role",
	description:
		"Find and call a team member by their role (specialist, coordinator, member). Use when you know what type of expertise you need.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			role: {
				type: "string",
				enum: ["specialist", "coordinator", "member", "leader"],
				description: "The role of team member you need",
			},
			task_description: {
				type: "string",
				description: "Description of the task you're delegating",
			},
			context_messages: {
				type: "array",
				description:
					"Messages to provide as context to the team member (optional)",
			},
		},
		required: ["role", "task_description"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
	): Promise<IFunctionResponse> => {
		try {
			const serviceContext = resolveServiceContext({
				context: req.context,
				env: req.env,
				user: req.user ?? null,
			});
			serviceContext.ensureDatabase();
			const agentRepository = serviceContext.repositories.agents;
			const currentAgentId = req.request.current_agent_id;

			if (!currentAgentId) {
				logger.error("Delegation by role failed - no current_agent_id", {
					completion_id,
				});
				return {
					status: "error",
					content: "Current agent context not available for team delegation",
					role: "tool",
				};
			}

			const currentAgent = await agentRepository.getAgentById(currentAgentId);

			if (!currentAgent) {
				return {
					status: "error",
					content: "Current agent not found",
					role: "tool",
				};
			}

			const delegation = new TeamDelegation({
				env: req.env,
				user: req.user,
				currentAgent,
				delegationStack: req.request.delegation_stack,
				maxDelegationDepth: req.request.max_delegation_depth,
				rateLimitWindowMs: 60000,
				maxDelegationsPerWindow: 10,
			});

			const agent = await delegation.findAgentByRole(args.role);

			if (!agent) {
				return {
					status: "success",
					content: `No team member found with role "${args.role}". Available team members can be checked with get_team_members.`,
					role: "tool",
				};
			}

			return await delegateToTeamMember.function(
				completion_id,
				{
					agent_id: agent.id,
					task_description: args.task_description,
					context_messages: args.context_messages,
				},
				req,
			);
		} catch (error) {
			logger.error("Team delegation by role failed:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			return {
				status: "error",
				content: `Failed to delegate to team member by role: ${error}`,
				role: "tool",
			};
		}
	},
};

export const getTeamMembers: IFunction = {
	name: "get_team_members",
	description:
		"Get list of available team members with their roles and capabilities. Use this to see who's available for delegation.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {},
		required: [],
	},
	function: async (
		completion_id: string,
		_args: any,
		req: IRequest,
	): Promise<IFunctionResponse> => {
		try {
			const serviceContext = createServiceContext({
				env: req.env,
				user: req.user ?? null,
			});
			serviceContext.ensureDatabase();
			const agentRepository = serviceContext.repositories.agents;
			const currentAgentId = req.request.current_agent_id;

			if (!currentAgentId) {
				logger.error("get_team_members failed - no current_agent_id", {
					completion_id,
				});
				return {
					status: "error",
					content: "Current agent context not available for team operations",
					role: "tool",
				};
			}

			const currentAgent = await agentRepository.getAgentById(currentAgentId);

			if (!currentAgent) {
				return {
					status: "error",
					content: "Current agent not found",
					role: "tool",
				};
			}

			const delegation = new TeamDelegation({
				env: req.env,
				user: req.user,
				currentAgent,
			});

			const teamMembers = await delegation.getTeamMembers();

			if (teamMembers.length === 0) {
				return {
					status: "success",
					content: "No team members available.",
					role: "tool",
				};
			}

			const membersList = teamMembers
				.map(
					(member) =>
						`- **${member.name}** (ID: ${member.id}, Role: ${member.team_role || "member"}): ${member.description}`,
				)
				.join("\n");

			return {
				status: "success",
				content: `Available team members:\n\n${membersList}`,
				role: "tool",
			};
		} catch (error) {
			logger.error("Failed to get team members:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			return {
				status: "error",
				content: `Failed to get team members: ${error}`,
				role: "tool",
			};
		}
	},
};
