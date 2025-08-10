import { sanitiseMessages } from "~/lib/chat/utils";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import type { CoreChatOptions } from "~/types";

export class BasicInputValidator implements Validator {
  async validate(
    options: CoreChatOptions,
    _context: ValidationContext,
  ): Promise<ValidatorResult> {
    const { messages: rawMessages } = options;

    const sanitizedMessages = Array.isArray(rawMessages)
      ? sanitiseMessages(rawMessages)
      : [];

    if (!sanitizedMessages || sanitizedMessages.length === 0) {
      return {
        validation: {
          isValid: false,
          error: "Messages array is empty or invalid",
          validationType: "input",
        },
        context: {},
      };
    }

    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1] || null;
    if (!lastMessage) {
      return {
        validation: {
          isValid: false,
          error: "No valid last message found",
          validationType: "input",
        },
        context: {},
      };
    }

    return {
      validation: { isValid: true },
      context: {
        sanitizedMessages,
        lastMessage,
      },
    };
  }
}
