import { getModelConfigByMatchingModel } from "~/lib/models";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";

export class OpenAIProvider extends BaseProvider {
  name = "openai";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "OPENAI_API_KEY";
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

  private isImageGeneration(params: ChatCompletionParameters): boolean {
    return params.model === "gpt-image-1";
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    if (this.isImageGeneration(params)) {
      const hasAttachments = params.messages.some(
        (message) =>
          Array.isArray(message.content) &&
          message.content.some((c) => c.type === "image_url"),
      );
      return hasAttachments
        ? "https://api.openai.com/v1/images/edits"
        : "images/generations";
    }
    return "chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    const endpoint = this.getEndpoint(params);

    const isImageEdits = endpoint.includes("images/edits");

    const headers: Record<string, string> = {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Bearer ${apiKey}`,
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
      }),
    };

    if (!isImageEdits) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  private async downloadImageFromUrl(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.status} ${response.statusText}`,
      );
    }
    return await response.blob();
  }

  private buildImageEditFormData(params: any, imageBlob: Blob): FormData {
    const formData = new FormData();

    formData.append("model", params.model || "gpt-image-1");
    formData.append("prompt", params.prompt);
    formData.append("image", imageBlob, "image.png");

    if (params.size) {
      formData.append("size", params.size);
    }
    if (params.n) {
      formData.append("n", params.n.toString());
    }
    if (params.response_format) {
      formData.append("response_format", params.response_format);
    }

    return formData;
  }

  async createRealtimeSession(
    env: IEnv,
    user: IUser,
    type: string,
    body: Record<string, any>,
  ): Promise<any> {
    const model = body.model || "gpt-4o-realtime-preview";

    const endpoint =
      type === "transcription"
        ? "realtime/transcription_sessions"
        : "realtime/sessions";

    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST",
      headers: await this.getHeaders({
        env,
        user,
        model,
        message: "",
      }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AssistantError(
        "Failed to create realtime session",
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    return response.json();
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

    const commonParams = createCommonParameters(
      params,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const streamingParams = shouldEnableStreaming(
      modelConfig,
      this.supportsStreaming,
      params.stream,
    )
      ? { stream: true }
      : {};

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);

    const tools = [];
    if (modelConfig?.supportsFunctions) {
      if (
        modelConfig?.supportsSearchGrounding &&
        params.enabled_tools.includes("search_grounding")
      ) {
        tools.push({ type: "web_search_preview" });
      }
    }
    const allTools = [...tools, ...(toolsParams.tools || [])];

    const openaiSpecificTools =
      modelConfig?.supportsFunctions && tools.length > 0
        ? { tools: allTools }
        : {};

    const thinkingParams = modelConfig?.hasThinking
      ? { reasoning_effort: params.reasoning_effort }
      : {};

    let modelSpecificParams = {};
    if (params.model === "o1" || params.model === "o4-mini") {
      modelSpecificParams = {
        temperature: 1,
        top_p: undefined,
      };
    }

    if (params.model.includes("-search-preview")) {
      modelSpecificParams = {
        ...modelSpecificParams,
        frequency_penalty: undefined,
        presence_penalty: undefined,
        temperature: undefined,
        top_p: undefined,
      };
    }

    const type = modelConfig?.type || ["text"];

    if (type.includes("image-to-image") || type.includes("text-to-image")) {
      let prompt = "";
      if (params.messages.length > 1) {
        const content = params.messages[1].content;
        prompt = typeof content === "string" ? content : content[0]?.text || "";
      } else {
        const content = params.messages[0].content;
        prompt = typeof content === "string" ? content : content[0]?.text || "";
      }

      const hasImages = params.messages.some(
        (message) =>
          typeof message.content !== "string" &&
          message.content.some((item: any) => item.type === "image_url"),
      );

      const endpoint = this.getEndpoint(params);

      if (endpoint.includes("images/edits") && hasImages) {
        const messageWithImage = params.messages.find(
          (message) =>
            typeof message.content !== "string" &&
            message.content.some((item: any) => item.type === "image_url"),
        );

        if (!messageWithImage || typeof messageWithImage.content === "string") {
          throw new Error("No valid image found for image editing");
        }

        const imageItem = messageWithImage.content.find(
          (item: any) => item.type === "image_url",
        );
        if (!imageItem?.image_url?.url) {
          throw new Error("No image URL found for editing");
        }

        const imageBlob = await this.downloadImageFromUrl(
          imageItem.image_url.url,
        );

        const formDataParams = {
          model: params.model,
          prompt,
          size: "1024x1024",
          response_format: "url",
          n: 1,
        };

        return this.buildImageEditFormData(formDataParams, imageBlob);
      }

      if (type.includes("image-to-image") && hasImages) {
        if (typeof params.messages[1].content === "string") {
          throw new Error("Image to image is not supported for text input");
        }

        const imageUrls = params.messages[1].content
          .filter((item: any) => item.type === "image_url")
          .map((item: any) => item.image_url.url);

        if (imageUrls.length === 0) {
          throw new Error("No image urls found");
        }

        return {
          prompt,
          image: imageUrls,
        };
      }

      return {
        prompt,
      };
    }

    return {
      ...commonParams,
      ...streamingParams,
      ...toolsParams,
      ...openaiSpecificTools,
      ...thinkingParams,
      ...modelSpecificParams,
      store: params.store,
      logit_bias: params.logit_bias,
      n: params.n,
      stop: params.stop,
      user: typeof params.user === "string" ? params.user : params.user?.email,
    };
  }
}
