import { getAllAttachments } from "~/lib/chat/messages/attachments";
import { selectModels } from "~/lib/chat/policy/model-access";
import { resolveProjectModelTier } from "~/lib/chat/policy/project-model-tier";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import { findModelConfig } from "~/lib/providers/models";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { resolveRequestUser } from "~/utils/requestUser";

const logger = getLogger({
  prefix: "lib/chat/validation/validators/ModelConfigValidator",
});

export class ModelConfigValidator implements Validator {
  async validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult> {
    const {
      env,
      model: requestedModel,
      models: requestedModels,
      provider: requestedProvider,
      use_multi_model = false,
    } = options;
    const user = resolveRequestUser(options);

    if (!context.sanitisedMessages || !context.lastMessage) {
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

    const { allAttachments } = getAllAttachments(lastMessageContent);

    const tier = await resolveProjectModelTier(options);

    try {
      const selection = await selectModels({
        env,
        user,
        attachments: allAttachments,
        tier,
        requestedModel,
        requestedModels,
        requestedProvider,
        useMultiModel: use_multi_model,
      });

      logger.info("Selected models", { selectedModels: selection.models, tier });

      if (selection.models.length === 0) {
        return {
          validation: {
            isValid: false,
            error: "No models selected",
            validationType: "model",
          },
          context: {},
        };
      }

      const primaryModelName = selection.models[0];
      const primaryModelConfig = await findModelConfig(
        primaryModelName,
        env,
        requestedProvider,
        user?.id,
      );

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
          selectedModels: selection.models,
          reasoningEffort: selection.reasoningEffort,
        },
      };
    } catch (error: any) {
      if (
        error instanceof AssistantError &&
        (error.type === ErrorType.AUTHENTICATION_ERROR ||
          error.type === ErrorType.AUTHORISATION_ERROR ||
          error.type === ErrorType.FORBIDDEN ||
          error.type === ErrorType.UNAUTHORIZED)
      ) {
        throw error;
      }

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
