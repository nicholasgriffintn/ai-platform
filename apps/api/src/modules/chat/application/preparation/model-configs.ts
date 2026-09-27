import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigInfo, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ValidationContext } from "~/modules/chat/application/validation/ValidationPipeline";
import { resolveRequestModelConfig } from "~/modules/models/application/request-config";
import type { CoreChatOptions } from "~/types";

const logger = getLogger({ prefix: "services/chat/preparation/model-configs" });

export async function buildModelConfigs(
  options: CoreChatOptions,
  validationContext: ValidationContext,
): Promise<ModelConfigInfo[]> {
  const { provider: requestedProvider } = options;
  const { selectedModels, modelConfig: primaryModelConfig } = validationContext;

  if (!selectedModels || selectedModels.length === 0) {
    throw new AssistantError(
      "No selected models available from validation context",
      ErrorType.PARAMS_ERROR,
    );
  }

  const successfulConfigs: ModelConfigInfo[] = [];
  const seenModels = new Set<string>();
  const addConfig = (config: ModelConfigItem | null) => {
    if (!config) {
      return;
    }

    const modelKey = `${config.provider}::${config.matchingModel}`;

    if (seenModels.has(modelKey)) {
      return;
    }

    seenModels.add(modelKey);
    successfulConfigs.push({
      model: config.matchingModel,
      provider: config.provider,
      displayName: config.name || config.matchingModel,
    });
  };

  const shouldSkipPrimaryFetch = Boolean(primaryModelConfig);

  if (primaryModelConfig) {
    addConfig(primaryModelConfig);
  }

  const modelsToFetch = shouldSkipPrimaryFetch ? selectedModels.slice(1) : selectedModels.slice();

  const configResults = await Promise.allSettled(
    modelsToFetch.map((model) => resolveRequestModelConfig(options, model, requestedProvider)),
  );

  configResults.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      addConfig(result.value);

      return;
    }

    logger.warn("Failed to get model configuration", {
      model: modelsToFetch[index],
      error: result.status === "rejected" ? result.reason : "No config returned",
    });
  });

  if (successfulConfigs.length === 0) {
    throw new AssistantError(
      "No valid model configurations available",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return successfulConfigs;
}
