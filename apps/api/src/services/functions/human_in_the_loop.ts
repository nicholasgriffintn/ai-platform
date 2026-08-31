import { userQuestionsSchema } from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import type { ApiToolDefinition } from "../../types/functions";
import {
  request_approval as request_approvalDescriptor,
  ask_user as ask_userDescriptor,
} from "./definitions/human_in_the_loop";
import { findAnsweredQuestion } from "./userQuestionHistory";
import { normaliseAskUserInput } from "./userQuestionInput";

const logger = getLogger({ prefix: "services/functions/human_in_the_loop" });

export const request_approval: ApiToolDefinition = {
  ...request_approvalDescriptor,
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
  ...ask_userDescriptor,
  normaliseInput: normaliseAskUserInput,
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
