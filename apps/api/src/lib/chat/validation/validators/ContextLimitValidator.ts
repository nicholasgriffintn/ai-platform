import {
  checkContextWindowLimits,
  getAllAttachments,
  pruneMessagesToFitContext,
  sanitiseInput,
} from "~/lib/chat/utils";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import type { CoreChatOptions } from "~/types";

export class ContextLimitValidator implements Validator {
  async validate(
    _options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult> {
    if (
      !context.sanitizedMessages ||
      !context.lastMessage ||
      !context.modelConfig
    ) {
      return {
        validation: {
          isValid: false,
          error: "Missing required context for validation",
          validationType: "context",
        },
        context: {},
      };
    }

    try {
      const lastMessageContent = Array.isArray(context.lastMessage.content)
        ? context.lastMessage.content
        : [
            {
              type: "text" as const,
              text: context.lastMessage.content as string,
            },
          ];

      const lastMessageContentText =
        lastMessageContent.find((c) => c.type === "text")?.text || "";

      const { markdownAttachments } = getAllAttachments(lastMessageContent);
      const finalUserMessage = sanitiseInput(lastMessageContentText);

      const messageWithContext =
        markdownAttachments.length > 0
          ? `${finalUserMessage}\n\nContext from attached documents:\n${markdownAttachments
              .map(
                (doc) => `${doc.name ? `# ${doc.name}\n` : ""}${doc.markdown}`,
              )
              .join("\n\n")}`
          : finalUserMessage;

      const prunedWithAttachments =
        context.sanitizedMessages.length > 0
          ? pruneMessagesToFitContext(
              context.sanitizedMessages,
              messageWithContext,
              context.modelConfig,
            )
          : [];

      checkContextWindowLimits(
        prunedWithAttachments,
        messageWithContext,
        context.modelConfig,
      );

      return {
        validation: { isValid: true },
        context: {
          messageWithContext,
        },
      };
    } catch (error: any) {
      return {
        validation: {
          isValid: false,
          error: error.message || "Context window validation failed",
          validationType: "context",
        },
        context: {},
      };
    }
  }
}
