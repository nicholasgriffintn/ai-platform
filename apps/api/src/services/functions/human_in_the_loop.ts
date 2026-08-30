import {
  USER_QUESTION_MAX_OPTIONS,
  USER_QUESTION_SET_MAX_QUESTIONS,
  userQuestionsSchema,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import type { ApiToolDefinition } from "../../types/functions";
import { jsonSchemaToZod } from "../../utils/jsonSchema";
import { findAnsweredQuestion } from "./userQuestionHistory";

const logger = getLogger({ prefix: "services/functions/human_in_the_loop" });

export const request_approval: ApiToolDefinition = {
  name: "request_approval",
  description:
    "Request human approval before proceeding with an action. Use this for critical operations, irreversible changes, or when user confirmation is needed. Returns approval/rejection status.",
  type: "normal",
  costPerCall: 0,
  maxIdenticalCalls: 1,
  permissions: ["human"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "The approval message to show the user. Clearly explain what action requires approval and its consequences.",
      },
      options: {
        type: "array",
        description: "Optional array of approval options. Defaults to ['Approve', 'Reject']",
        items: {
          type: "string",
        },
      },
      context: {
        type: "object",
        description: "Optional context data about what's being approved (for logging/auditing)",
      },
    },
    required: ["message"],
  }),
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;

    const { message, options, context: requestContext } = args || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
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
      } catch {
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

    let parsedContext = requestContext;

    if (typeof requestContext === "string") {
      try {
        parsedContext = JSON.parse(requestContext);
      } catch {
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

export const ask_user: ApiToolDefinition = {
  name: "ask_user",
  description:
    "Ask the user up to three concise questions and wait for their response. Use this only when missing information or an unresolved decision prevents progress, never to ask the user to approve or confirm your output. Reuse answers already present in the conversation. Offer useful choices where possible and allow a written answer when the choices are incomplete.",
  type: "normal",
  costPerCall: 0,
  maxIdenticalCalls: 1,
  permissions: ["human"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      questions: {
        type: "array",
        description:
          "One to three questions that can be answered together. Every item must use the exact fields id and prompt. Options use label and may include description.",
        minItems: 1,
        maxItems: USER_QUESTION_SET_MAX_QUESTIONS,
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "A stable lowercase identifier for this decision, such as pricing or audience. Reuse the same identifier if referring to the same decision again.",
            },
            prompt: {
              type: "string",
              description: "A clear, specific question that explains the decision needed.",
            },
            options: {
              type: "array",
              maxItems: USER_QUESTION_MAX_OPTIONS,
              description: "Useful choices. Omit when a free-form answer is more appropriate.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
                required: ["label"],
              },
            },
            allowOther: {
              type: "boolean",
              description: "Allow a written answer in addition to the choices. Defaults to true.",
            },
          },
          required: ["id", "prompt"],
        },
      },
    },
    required: ["questions"],
  }),
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const parsed = userQuestionsSchema.safeParse(args?.questions);

    if (!parsed.success) {
      throw new AssistantError(
        "questions must contain between one and three valid questions",
        ErrorType.PARAMS_ERROR,
      );
    }

    if (context.conversationManager) {
      const history = await context.conversationManager.get(completion_id);

      for (const question of parsed.data) {
        const answered = findAnsweredQuestion(history, question);

        if (answered) {
          throw new AssistantError(
            `The question "${answered.prompt}" has already been answered in this conversation. Continue with the recorded answer instead of asking again.`,
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }
      }
    }

    const interactionId = generateId();
    const requestedAt = new Date().toISOString();

    logger.info("User question created", {
      completion_id,
      question_count: parsed.data.length,
      user_id: req.user?.id,
    });

    return {
      name: "ask_user",
      status: "pending",
      content:
        parsed.data.length === 1
          ? parsed.data[0].prompt
          : `Waiting for answers to ${parsed.data.length} questions.`,
      data: {
        completion_id,
        interactionId,
        questions: parsed.data,
        requestedAt,
        humanInTheLoop: {
          type: "question",
          status: "pending",
          interactionId,
          questions: parsed.data,
          requires_user_action: true,
        },
      },
    };
  },
};
