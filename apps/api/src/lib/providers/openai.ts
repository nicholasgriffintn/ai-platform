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

interface ImageEditParams {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
}

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_IMAGE_COUNT = 1;

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

  private getImageFileName(blob: Blob): string {
    const mimeTypeToExtension: Record<string, string> = {
      "image/png": "image.png",
      "image/jpeg": "image.jpg",
      "image/jpg": "image.jpg",
      "image/webp": "image.webp",
    };

    return mimeTypeToExtension[blob.type] || "image.png";
  }

  private buildImageEditFormData(
    params: ImageEditParams,
    imageBlob: Blob,
  ): FormData {
    const formData = new FormData();

    formData.append("model", params.model || "gpt-image-1");
    formData.append("prompt", params.prompt);
    formData.append("image", imageBlob, this.getImageFileName(imageBlob));

    if (params.size) {
      formData.append("size", params.size);
    }
    if (params.n) {
      formData.append("n", params.n.toString());
    }

    return formData;
  }

  private async handleImageEditRequest(
    params: ChatCompletionParameters,
    prompt: string,
    storageService: StorageService,
  ): Promise<FormData> {
    const messageWithImage = params.messages.find(
      (message) =>
        typeof message.content !== "string" &&
        message.content.some((item: any) => item.type === "image_url"),
    );

    if (!messageWithImage || typeof messageWithImage.content === "string") {
      throw new AssistantError(
        "No valid image found for image editing",
        ErrorType.PARAMS_ERROR,
      );
    }

    const imageItem = messageWithImage.content.find(
      (item: any) => item.type === "image_url",
    );
    if (!imageItem?.image_url?.url) {
      throw new AssistantError(
        "No image URL found for editing",
        ErrorType.PARAMS_ERROR,
      );
    }

    const imageBlob = await storageService.downloadFile(
      imageItem.image_url.url,
    );

    const formDataParams: ImageEditParams = {
      model: params.model,
      prompt,
      size: DEFAULT_IMAGE_SIZE,
      n: DEFAULT_IMAGE_COUNT,
    };

    return this.buildImageEditFormData(formDataParams, imageBlob);
  }

  private handleImageToImageRequest(
    params: ChatCompletionParameters,
    prompt: string,
  ): Record<string, any> {
    if (typeof params.messages[1].content === "string") {
      throw new AssistantError(
        "Image to image is not supported for text input",
        ErrorType.PARAMS_ERROR,
      );
    }

    const imageUrls = params.messages[1].content
      .filter((item: any) => item.type === "image_url")
      .map((item: any) => item.image_url.url);

    if (imageUrls.length === 0) {
      throw new AssistantError("No image urls found", ErrorType.PARAMS_ERROR);
    }

    return {
      prompt,
      image: imageUrls,
    };
  }

  private handleTextToImageRequest(prompt: string): Record<string, any> {
    return {
      prompt,
    };
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
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
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
    if (modelConfig?.supportsToolCalls) {
      if (
        modelConfig?.supportsSearchGrounding &&
        params.enabled_tools.includes("search_grounding")
      ) {
        tools.push({ type: "web_search_preview" });
      }
    }
    const allTools = [...tools, ...(toolsParams.tools || [])];

    const openaiSpecificTools =
      modelConfig?.supportsToolCalls && allTools.length > 0
        ? { tools: allTools }
        : {};

    const thinkingParams = modelConfig?.supportsReasoning
      ? { reasoning_effort: params.reasoning_effort }
      : {};

    let modelSpecificParams = {};

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
        if (!_storageService) {
          throw new AssistantError(
            "StorageService is required for image editing",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return await this.handleImageEditRequest(
          params,
          prompt,
          _storageService,
        );
      }

      if (type.includes("image-to-image") && hasImages) {
        return this.handleImageToImageRequest(params, prompt);
      }

      return this.handleTextToImageRequest(prompt);
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
