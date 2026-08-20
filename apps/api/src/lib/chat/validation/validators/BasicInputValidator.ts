import { sanitiseMessages } from "~/lib/chat/messages/sanitise";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import type { CoreChatOptions } from "~/types";

export class BasicInputValidator implements Validator {
  async validate(options: CoreChatOptions, _context: ValidationContext): Promise<ValidatorResult> {
    const { messages: rawMessages } = options;

    const sanitisedMessages = Array.isArray(rawMessages) ? sanitiseMessages(rawMessages) : [];

    if (!sanitisedMessages || sanitisedMessages.length === 0) {
      return {
        validation: {
          isValid: false,
          error: "Messages array is empty or invalid",
          validationType: "input",
        },
        context: {},
      };
    }

    const lastMessage = sanitisedMessages[sanitisedMessages.length - 1] || null;

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
        sanitisedMessages,
        lastMessage,
      },
    };
  }
}
