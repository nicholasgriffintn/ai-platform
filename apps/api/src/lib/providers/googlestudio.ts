import { getModelConfigByMatchingModel } from "~/lib/models";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getEffectiveMaxTokens } from "~/utils/parameters";
import { BaseProvider } from "./base";

export class GoogleStudioProvider extends BaseProvider {
  name = "google-ai-studio";
  supportsStreaming = true;
  // TODO: Work out if we should use OpenAI compatible mode - it might take away some of the Google-specific features
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "GOOGLE_STUDIO_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected async getEndpoint(
    params: ChatCompletionParameters,
  ): Promise<string> {
    if (params.stream) {
      return `v1beta/models/${params.model}:streamGenerateContent?alt=sse`;
    }
    return `v1beta/models/${params.model}:generateContent`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
        userId: params.user?.id,
        platform: params.platform,
      }),
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new Error(`Model configuration not found for ${params.model}`);
    }

    const enabledTools = (params.enabled_tools || []).filter(
      (tool) =>
        !(tool === "web_search" && modelConfig?.supportsSearchGrounding),
    );
    const tools = [];

    if (
      modelConfig?.supportsCodeExecution &&
      enabledTools.includes("code_execution")
    ) {
      tools.push({
        code_execution: {},
      });
    } else if (
      modelConfig?.supportsSearchGrounding &&
      enabledTools.includes("search_grounding")
    ) {
      tools.push({
        google_search: {},
      });
    }

    const hasEnabledExclusiveTools =
      enabledTools.includes("code_execution") ||
      enabledTools.includes("search_grounding");

    if (
      modelConfig?.supportsToolCalls &&
      !hasEnabledExclusiveTools &&
      params.tools?.length > 0
    ) {
      const formattedTools = params.tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: {
          type: tool.function.parameters.type,
          properties: tool.function.parameters.properties,
        },
        required: tool.function.required,
      }));
      tools.push({
        functionDeclarations: formattedTools,
      });
    }

    return {
      model: params.model,
      contents: this.formatGoogleStudioContents(params),
      tools: modelConfig?.supportsToolCalls ? tools : undefined,
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: params.system_prompt,
          },
        ],
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
      ],
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: getEffectiveMaxTokens(
          params.max_tokens,
          modelConfig?.maxTokens,
        ),
        topP: params.top_p,
        topK: params.top_k,
        seed: params.seed,
        repetitionPenalty: params.repetition_penalty,
        frequencyPenalty: params.frequency_penalty,
        presencePenalty: params.presence_penalty,
        stopSequences: params.stop,
      },
    };
  }

  /**
   * Format messages for Google Studio models
   * @param params - The chat completion parameters
   * @returns The formatted messages
   */
  private formatGoogleStudioContents(params: ChatCompletionParameters): any[] {
    const contents = [];

    params.messages.forEach((message) => {
      contents.push({
        role: message.role === "assistant" ? "model" : message.role,
        parts: message.parts,
      });
    });

    return contents;
  }
}
