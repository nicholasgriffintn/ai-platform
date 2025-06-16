import { getModelConfig } from "~/lib/models";
import type { CoreChatOptions } from "../../core";
import { selectModels } from "../../modelSelection";
import { getAllAttachments } from "../../utils";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "../ValidationPipeline";

export class ModelConfigValidator implements Validator {
  async validate(
    options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult> {
    const {
      env,
      user,
      model: requestedModel,
      completion_id,
      use_multi_model = false,
      budget_constraint,
    } = options;

    if (!context.sanitizedMessages || !context.lastMessage) {
      return {
        validation: {
          isValid: false,
          error: "Missing sanitized messages context",
          validationType: "model",
        },
        context: {},
      };
    }

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

    const { allAttachments } = getAllAttachments(lastMessageContent);

    try {
      const selectedModels = await selectModels(
        env,
        lastMessageContentText,
        allAttachments,
        budget_constraint,
        user,
        completion_id,
        requestedModel,
        use_multi_model,
      );

      const primaryModelName = selectedModels[0];
      const primaryModelConfig = await getModelConfig(primaryModelName, env);

      if (!primaryModelConfig) {
        return {
          validation: {
            isValid: false,
            error: "Invalid model configuration",
            validationType: "model",
          },
          context: {},
        };
      }

      return {
        validation: { isValid: true },
        context: {
          modelConfig: primaryModelConfig,
        },
      };
    } catch (error: any) {
      return {
        validation: {
          isValid: false,
          error: `Model validation failed: ${error.message}`,
          validationType: "model",
        },
        context: {},
      };
    }
  }
}
