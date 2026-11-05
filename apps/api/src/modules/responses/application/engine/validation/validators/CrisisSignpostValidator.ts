import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";

import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/modules/responses/application/engine/validation/ValidationPipeline";
import { mentionsCrisis } from "~/modules/responses/domain/crisis-signposting";
import type { CoreChatOptions } from "~/types";

const UNATTENDED_TRIGGERS = new Set(["delegation", "schedule"]);

function expectsPlainText(options: CoreChatOptions): boolean {
  const format = options.response_format;

  return !format || ("type" in format && format.type === "text");
}

export class CrisisSignpostValidator implements Validator {
  async validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult> {
    const { lastMessage } = context;
    const crisisSignpost =
      lastMessage?.role === "user" &&
      !UNATTENDED_TRIGGERS.has(options.trigger ?? "user") &&
      expectsPlainText(options) &&
      mentionsCrisis(extractTextFromMessageContent(lastMessage.content));

    return {
      validation: { isValid: true },
      context: crisisSignpost ? { crisisSignpost } : {},
    };
  }
}
