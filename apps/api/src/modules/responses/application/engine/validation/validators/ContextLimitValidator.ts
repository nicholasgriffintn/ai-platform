import {
  checkContextWindowLimits,
  pruneMessagesToFitContext,
  resolveContextWindow,
} from "@ngriffin_uk/polychat-ai-agents";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { digestDocument, formatDocumentDigest } from "~/modules/documents/application/digest";
import { getAllAttachments } from "~/modules/responses/application/engine/messages/attachments";
import {
  attachmentTokenBudget,
  fitMarkdownAttachments,
} from "~/modules/responses/application/engine/preparation/attachment-budget";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/modules/responses/application/engine/validation/ValidationPipeline";
import type { Attachment, CoreChatOptions } from "~/types";

export class ContextLimitValidator implements Validator {
  async validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult> {
    if (!context.sanitisedMessages || !context.lastMessage || !context.modelConfig) {
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

      const lastMessageContentText = lastMessageContent.find((c) => c.type === "text")?.text || "";

      const finalUserMessage = sanitiseInput(lastMessageContentText);
      const markdownAttachments = await this.fitAttachments(
        options,
        getAllAttachments(lastMessageContent).markdownAttachments,
        attachmentTokenBudget(resolveContextWindow(context.modelConfig), finalUserMessage),
      );

      const messageWithContext =
        markdownAttachments.length > 0
          ? `${finalUserMessage}\n\nContext from attached documents:\n${markdownAttachments
              .map((doc) => `${doc.name ? `# ${doc.name}\n` : ""}${doc.markdown}`)
              .join("\n\n")}`
          : finalUserMessage;

      const prunedWithAttachments =
        context.sanitisedMessages.length > 0
          ? pruneMessagesToFitContext(
              context.sanitisedMessages,
              messageWithContext,
              context.modelConfig,
            )
          : [];

      checkContextWindowLimits(prunedWithAttachments, messageWithContext, context.modelConfig);

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

  private fitAttachments(
    options: CoreChatOptions,
    attachments: Attachment[],
    budgetTokens: number,
  ): Promise<Attachment[]> {
    const user = options.context?.user;

    if (!user?.id) {
      return Promise.resolve(attachments);
    }

    return fitMarkdownAttachments(attachments, budgetTokens, async (attachment) =>
      formatDocumentDigest(
        attachment.name,
        await digestDocument({ env: options.env, user, markdown: attachment.markdown ?? "" }),
      ),
    );
  }
}
