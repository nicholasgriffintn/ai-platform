import type { CoreChatOptions } from "../../core";
import { sanitiseMessages } from "../../utils";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "../ValidationPipeline";

export class BasicInputValidator implements Validator {
  async validate(
    options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult> {
    const { messages: rawMessages } = options;

    const sanitizedMessages = Array.isArray(rawMessages)
      ? sanitiseMessages(rawMessages)
      : [];

    if (sanitizedMessages.length === 0) {
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
