import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import {
  buildGoogleStudioGenerationConfig,
  buildGoogleStudioSystemInstruction,
  buildGoogleStudioTools,
  formatGoogleStudioContents,
  GOOGLE_STUDIO_SAFETY_SETTINGS,
} from "~/lib/providers/utils/googleStudio";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { omitUndefinedValues } from "~/utils/objects";
import { getToolsForProvider } from "~/utils/parameters";

import { BaseProvider } from "./base";

const VERTEX_EXPRESS_BASE_URL = "https://aiplatform.googleapis.com/v1";

export class GoogleVertexProvider extends BaseProvider {
  name = "google-vertex";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "GOOGLE_VERTEX_API_KEY";
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const modelConfig = await getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
    );
    const model = modelConfig?.matchingModel || params.model;
    const method = params.stream ? "streamGenerateContent?alt=sse" : "generateContent";

    return `${VERTEX_EXPRESS_BASE_URL}/publishers/google/models/${model}:${method}`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const functionToolParams = {
      ...params,
      enabled_tools: (params.enabled_tools || []).filter(
        (tool) => !(tool === "web_search" && modelConfig.supportsSearchGrounding),
      ),
    };
    const toolsParams = getToolsForProvider(functionToolParams, modelConfig, this.name);
    const providerParams = {
      ...params,
      tools: toolsParams.tools ?? params.tools,
    };

    return omitUndefinedValues({
      model: modelConfig.matchingModel,
      contents: formatGoogleStudioContents(providerParams),
      tools: buildGoogleStudioTools(providerParams, modelConfig),
      systemInstruction: buildGoogleStudioSystemInstruction(providerParams.system_prompt),
      safetySettings: GOOGLE_STUDIO_SAFETY_SETTINGS,
      generationConfig: buildGoogleStudioGenerationConfig(providerParams, modelConfig),
    });
  }
}
