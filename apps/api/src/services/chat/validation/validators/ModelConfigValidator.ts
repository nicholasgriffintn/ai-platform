import { resolveRequestUser } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getAllAttachments } from "~/services/chat/messages/attachments";
import { selectModels } from "~/services/chat/policy/model-access";
import {
  resolveConversationModelSelection,
  resolveProjectModelTier,
} from "~/services/chat/policy/project-model-tier";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/services/chat/validation/ValidationPipeline";
import { findModelConfig } from "~/services/models/resolve";
import type { CoreChatOptions } from "~/types";

const logger = getLogger({
  prefix: "services/chat/validation/validators/ModelConfigValidator",
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

    const storedSelection = await resolveConversationModelSelection(options);
    const userSettings = options.context ? await options.context.getUserSettings() : null;
    const hasExplicitModel = Boolean(requestedModel || requestedModels?.length);
    const effectiveModel =
      requestedModel ??
      (!requestedModels?.length
        ? (storedSelection.modelId ??
          (!storedSelection.conversationExists
            ? (userSettings?.default_model_id ?? undefined)
            : undefined))
        : undefined);
    const usesModelTier = !hasExplicitModel && !effectiveModel;
    const tier = await resolveProjectModelTier(options);

    try {
      const selection = await selectModels({
        env,
        user,
        attachments: allAttachments,
        tier,
        requestedModel: effectiveModel,
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
          ...(usesModelTier ? { modelTier: tier } : {}),
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
