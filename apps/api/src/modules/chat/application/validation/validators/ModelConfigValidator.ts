import { resolveRequestUser } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getAllAttachments } from "~/modules/chat/application/messages/attachments";
import { selectModels } from "~/modules/chat/application/policy/model-access";
import { applyProjectModelGovernance } from "~/modules/chat/application/policy/project-model-governance";
import {
  resolveConversationModelSelection,
  resolveProjectModelTier,
} from "~/modules/chat/application/policy/project-model-tier";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/modules/chat/application/validation/ValidationPipeline";
import { findModelConfig } from "~/modules/models/application/resolve";
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

      const governed = await applyProjectModelGovernance(options, {
        models: selection.models,
        provider: requestedProvider,
        usesModelTier,
      });

      logger.info("Selected models", { selectedModels: governed.models, tier });

      if (governed.models.length === 0) {
        return {
          validation: {
            isValid: false,
            error: "No models selected",
            validationType: "model",
          },
          context: {},
        };
      }

      const primaryModelName = governed.models[0];
      const primaryModelConfig = await findModelConfig(
        primaryModelName,
        env,
        governed.provider,
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
          selectedModels: governed.models,
          ...(usesModelTier ? { modelTier: tier } : {}),
          reasoningEffort: selection.reasoningEffort,
          ...(governed.analyticsProperties
            ? { analyticsProperties: governed.analyticsProperties }
            : {}),
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
