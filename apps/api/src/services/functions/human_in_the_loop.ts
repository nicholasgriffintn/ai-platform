import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/human_in_the_loop" });

export const request_approval: IFunction = {
	name: "request_approval",
	description:
		"Request human approval before proceeding with an action. Use this for critical operations, irreversible changes, or when user confirmation is needed. Returns approval/rejection status.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			message: {
				type: "string",
				description:
					"The approval message to show the user. Clearly explain what action requires approval and its consequences.",
			},
			options: {
				type: "array",
				description:
					"Optional array of approval options. Defaults to ['Approve', 'Reject']",
				items: {
					type: "string",
				},
			},
			context: {
				type: "object",
				description:
					"Optional context data about what's being approved (for logging/auditing)",
			},
		},
		required: ["message"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		_app_url?: string,
		_conversationManager?: ConversationManager,
	) => {
		const { message, options, context } = args || {};

		if (
			!message ||
			typeof message !== "string" ||
			message.trim().length === 0
		) {
			throw new AssistantError(
				"message is required and must be a non-empty string",
				ErrorType.PARAMS_ERROR,
			);
		}

		let parsedOptions = options;
		if (typeof options === "string") {
			const normalizedOptions = options.replace(/'/g, '"');
			try {
				parsedOptions = JSON.parse(normalizedOptions);
			} catch (error) {
				parsedOptions = options
					.split(",")
					.map((opt) => opt.trim())
					.filter((opt) => opt.length > 0);

				if (parsedOptions.length === 0) {
					throw new AssistantError(
						'options must be valid JSON array (e.g., ["Yes", "No"]) or comma-separated values (e.g., Yes, No)',
						ErrorType.PARAMS_ERROR,
					);
				}
			}
		}

		let parsedContext = context;
		if (typeof context === "string") {
			try {
				parsedContext = JSON.parse(context);
			} catch (error) {
				throw new AssistantError(
					"context must be valid JSON when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
		}

		const approvalOptions = parsedOptions || ["Approve", "Reject"];

		logger.info("Approval request created", {
			completion_id,
			message: message.substring(0, 100),
			options: approvalOptions,
			user_id: req.user?.id,
		});

		return {
			name: "request_approval",
			status: "pending",
			content: message,
			data: {
				completion_id,
				message,
				options: approvalOptions,
				context: parsedContext,
				timestamp: new Date().toISOString(),
				humanInTheLoop: {
					type: "approval",
					status: "pending",
					message,
					options: approvalOptions,
					requires_user_action: true,
				},
			},
		};
	},
};

export const ask_user: IFunction = {
	name: "ask_user",
	description:
		"Ask the user a question and wait for their response. Use this when you need additional information, clarification, or input from the user to continue. Returns the user's answer.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			question: {
				type: "string",
				description:
					"The question to ask the user. Be clear and specific about what information you need.",
			},
			expected_format: {
				type: "string",
				description:
					"Optional description of the expected answer format (e.g., 'yes/no', 'a number between 1-10', 'a valid email address')",
			},
			suggestions: {
				type: "array",
				description:
					"Optional array of suggested answers to display as quick-reply buttons",
				items: {
					type: "string",
				},
			},
			context: {
				type: "object",
				description:
					"Optional context data about why this question is being asked",
			},
		},
		required: ["question"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		_app_url?: string,
		_conversationManager?: ConversationManager,
	) => {
		const { question, expected_format, suggestions, context } = args || {};

		if (
			!question ||
			typeof question !== "string" ||
			question.trim().length === 0
		) {
			throw new AssistantError(
				"question is required and must be a non-empty string",
				ErrorType.PARAMS_ERROR,
			);
		}

		let parsedSuggestions = suggestions;
		if (typeof suggestions === "string") {
			const normalizedSuggestions = suggestions.replace(/'/g, '"');
			try {
				parsedSuggestions = JSON.parse(normalizedSuggestions);
			} catch (error) {
				parsedSuggestions = suggestions
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);

				if (parsedSuggestions.length === 0) {
					parsedSuggestions = undefined;
				}
			}
		}

		let parsedContext = context;
		if (typeof context === "string") {
			try {
				parsedContext = JSON.parse(context);
			} catch (error) {
				throw new AssistantError(
					"context must be valid JSON when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
		}

		logger.info("User question created", {
			completion_id,
			question: question.substring(0, 100),
			expected_format,
			user_id: req.user?.id,
		});

		return {
			name: "ask_user",
			status: "pending",
			content: question,
			data: {
				completion_id,
				question,
				expected_format,
				suggestions: parsedSuggestions,
				context: parsedContext,
				timestamp: new Date().toISOString(),
				humanInTheLoop: {
					type: "question",
					status: "pending",
					question,
					expected_format,
					suggestions: parsedSuggestions,
					requires_user_action: true,
				},
			},
		};
	},
};
