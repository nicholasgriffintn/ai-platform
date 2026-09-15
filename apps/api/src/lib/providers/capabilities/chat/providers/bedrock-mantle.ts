import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { buildOpenAIResponsesBody } from "~/lib/providers/utils/openaiResponses";
import { resolvePrivateAssetUrls } from "~/lib/providers/utils/privateAssets";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { createStreamingParameters, getToolsForProvider } from "~/utils/parameters";

import { BaseProvider } from "./base";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_API_BASE_URL = "https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1";
const DEFAULT_API_SHAPE = "responses";

type MantleApiShape = "chat" | "responses";

export class BedrockMantleProvider extends BaseProvider {
  name = "bedrock-mantle";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "BEDROCK_MANTLE_API_KEY";
  }

  private getRegion(params: ChatCompletionParameters): string {
    return (
      params.env.BEDROCK_MANTLE_AWS_REGION ||
      params.env.BEDROCK_AWS_REGION ||
      params.env.AWS_REGION ||
      DEFAULT_REGION
    );
  }

  private resolveApiShape(modelConfig?: ModelConfigItem): MantleApiShape {
    const shape = modelConfig?.apiShape || DEFAULT_API_SHAPE;

    if (shape !== "chat" && shape !== "responses") {
      throw new AssistantError(
        `Unsupported Bedrock Mantle API shape: ${shape}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return shape;
  }

  private resolveApiBaseUrl(modelConfig: ModelConfigItem | undefined, region: string): string {
    const template = modelConfig?.apiBaseUrl || DEFAULT_API_BASE_URL;

    return template.replaceAll("${AWS_REGION}", region);
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const modelConfig = await getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
    );
    const baseUrl = this.resolveApiBaseUrl(modelConfig, this.getRegion(params));

    return this.resolveApiShape(modelConfig) === "responses"
      ? `${baseUrl}/responses`
      : `${baseUrl}/chat/completions`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: StorageService,
    assetsUrl?: string,
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

    if (this.resolveApiShape(modelConfig) !== "responses") {
      return await this.defaultMapParameters(params, storageService, assetsUrl);
    }

    const providerParams = storageService
      ? await resolvePrivateAssetUrls({ params, storageService, assetsUrl })
      : params;
    const toolsParams = getToolsForProvider(providerParams, modelConfig, this.name);

    return buildOpenAIResponsesBody(
      providerParams,
      modelConfig,
      toolsParams.tools || [],
      createStreamingParameters(modelConfig, this.supportsStreaming, providerParams.stream, {
        includeUsage: false,
      }),
    );
  }
}
