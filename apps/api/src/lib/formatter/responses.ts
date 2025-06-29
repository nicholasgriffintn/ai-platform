import type { IEnv } from "~/types";
import { StorageService } from "../storage";
import { uploadAudioFromChat, uploadImageFromChat } from "../upload";

interface ResponseFormatOptions {
  model?: string;
  type?: string[];
  env?: IEnv;
  completion_id?: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class ResponseFormatter {
  /**
   * Preprocesses QwQ model responses to ensure proper <think> tag formatting
   * QwQ models generate thinking content but don't include the opening <think> tag
   * @param content - The response content to preprocess
   * @param model - The model identifier
   * @returns The preprocessed content with <think> tag if needed
   */
  private static preprocessQwQResponse(content: string, model?: string): string {
    if (!model || !content) {
      return content;
    }

    // Check if this is a QwQ model
    const isQwQModel = model.toLowerCase().includes("qwq");
    if (!isQwQModel) {
      return content;
    }

    // Check if response contains </think> but doesn't start with <think>
    const hasClosingThink = content.includes("</think>");
    const startsWithThink = content.trim().startsWith("<think>");

    if (hasClosingThink && !startsWithThink) {
      return `<think>\n${content}`;
    }

    return content;
  }
  /**
   * Formats responses from any provider
   * Handles specific response formats for each provider
   * @param data - The data to format
   * @param provider - The provider of the data
   * @param options - The options for formatting
   * @returns The formatted data
   */
  static async formatResponse(
    data: any,
    provider: string,
    options: ResponseFormatOptions = {},
  ): Promise<any> {
    const formatter = ResponseFormatter.getFormatter(provider);
    return await formatter(data, options);
  }

  /**
   * Get the appropriate formatter function for a provider
   * @param provider - The provider of the data
   * @returns The formatter function
   */
  private static getFormatter(
    provider: string,
  ): (data: any, options: ResponseFormatOptions) => any {
    const formatters: Record<
      string,
      (data: any, options: ResponseFormatOptions) => any
    > = {
      openai: ResponseFormatter.formatOpenAIResponse,
      anthropic: ResponseFormatter.formatAnthropicResponse,
      "google-ai-studio": ResponseFormatter.formatGoogleStudioResponse,
      ollama: ResponseFormatter.formatOllamaResponse,
      bedrock: ResponseFormatter.formatBedrockResponse,
      workers: ResponseFormatter.formatWorkersResponse,
      "workers-ai": ResponseFormatter.formatWorkersResponse,
      openrouter: ResponseFormatter.formatOpenRouterResponse,
      groq: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      mistral: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "perplexity-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      deepseek: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      huggingface: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "github-models": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "together-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
    };

    return formatters[provider] || ResponseFormatter.formatGenericResponse;
  }

  private static async uploadImages(
    imageUrls: string[],
    options: ResponseFormatOptions,
  ): Promise<any> {
    const env = options.env;

    if (!env?.ASSETS_BUCKET) {
      throw new Error("ASSETS_BUCKET is not set");
    }

    const storageService = new StorageService(env.ASSETS_BUCKET);

    const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";

    const uploadedImageUrls = await Promise.all(
      imageUrls.map(async (url) => {
        const imageKey = `generations/${options.completion_id || "completion"}/${options.model || "model"}/${Date.now()}.png`;
        const imageBuffer = await fetch(url).then((res) => res.arrayBuffer());
        await storageService.uploadObject(imageKey, imageBuffer, {
          contentType: "image/png",
          contentLength: imageBuffer.byteLength,
        });
        return `${baseAssetsUrl}/${imageKey}`;
      }),
    );

    return uploadedImageUrls;
  }

  /**
   * Format generic/unknown provider responses
   * Attempts to extract content from common response formats
   * @param data - The data to format
   * @returns The formatted data
   */
  private static formatGenericResponse(data: any): any {
    if (data.response !== undefined) {
      return data;
    }

    if (data.choices?.[0]) {
      if (data.choices[0].message?.content) {
        return { ...data, response: data.choices[0].message.content };
      }
      if (data.choices[0].delta?.content !== undefined) {
        return { ...data, response: data.choices[0].delta.content || "" };
      }
      if (data.choices[0].text) {
        return { ...data, response: data.choices[0].text };
      }
    }

    if (data.delta?.text) {
      return { ...data, response: data.delta.text };
    }

    if (data.content && typeof data.content === "string") {
      return { ...data, response: data.content };
    }

    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content
        .filter((item: any) => item.type === "text" && item.text)
        .map((item: any) => item.text)
        .join(" ");

      const thinkingContent = data.content.find(
        (item: any) => item.type === "thinking" && item.thinking,
      );

      return {
        ...data,
        response: textContent || "",
        thinking: thinkingContent?.thinking || "",
        signature: thinkingContent?.signature || "",
      };
    }

    if (data.message?.content) {
      if (typeof data.message.content === "string") {
        return { ...data, response: data.message.content };
      }
      if (Array.isArray(data.message.content)) {
        const textContent = data.message.content
          .filter((item: any) => item.type === "text" && item.text)
          .map((item: any) => item.text)
          .join(" ");

        const thinkingContent = data.message.content.find(
          (item: any) => item.type === "thinking" && item.thinking,
        );

        return {
          ...data,
          response: textContent || "",
          thinking: thinkingContent?.thinking || "",
          signature: thinkingContent?.signature || "",
        };
      }
    }

    return { ...data, response: "" };
  }

  private static async formatOpenAIResponse(
    data: any,
    options: ResponseFormatOptions,
  ): Promise<any> {
    const isImageType =
      options.type?.includes("image-to-image") ||
      options.type?.includes("text-to-image");
    if (isImageType && Array.isArray(data.data)) {
      const dataImageUrls = data.data
        .filter((item) => item.url)
        .map((item) => item.url);

      let imageUrls: string[];
      if (options.env) {
        imageUrls = await ResponseFormatter.uploadImages(
          dataImageUrls,
          options,
        );
      } else {
        imageUrls = dataImageUrls;
      }

      let imagesContent = [];
      if (imageUrls.length > 0) {
        imagesContent = imageUrls.map((url) => ({
          type: "image_url",
          image_url: { url },
        }));
      }

      return { ...data, response: imagesContent };
    }

    const message = data.choices?.[0]?.message;
    let content = message?.content || "";
    
    // Preprocess QwQ model responses to add missing <think> tags
    content = ResponseFormatter.preprocessQwQResponse(content, options.model);
    
    return { ...data, response: content, ...message };
  }

  private static formatOpenRouterResponse(data: any): any {
    const message = data.choices?.[0]?.message;
    const content = message?.content || "";

    return {
      ...data,
      response: content,
    };
  }

  private static formatAnthropicResponse(data: any): any {
    if (!data.content) {
      return { ...data, response: "" };
    }

    const textContent = data.content
      .filter((content: any) => content.type === "text" && content.text)
      .map((content: any) => content.text)
      .join(" ");

    const thinkingContent = data.content.find(
      (content: any) => content.type === "thinking" && content.thinking,
    );

    return {
      ...data,
      response: textContent,
      thinking: thinkingContent?.thinking || "",
      signature: thinkingContent?.signature || "",
    };
  }

  private static formatGoogleStudioResponse(data: any): any {
    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      return { ...data, response: "", tool_calls: [] };
    }

    const parts = data.candidates[0].content.parts;
    const toolCalls: Record<string, any>[] = [];

    let textResponse = "";

    parts.forEach((part: any, index: number) => {
      if (part.text) {
        textResponse += (textResponse ? "\n" : "") + part.text;
      } else if (part.functionCall) {
        const fc = part.functionCall;
        toolCalls.push({ name: fc.name, arguments: fc.args });
      } else if (part.executableCode) {
        const code = part.executableCode;
        const language = code.language?.toLowerCase() || "code";
        textResponse += `\n\n<artifact identifier="executable-code-${index}" type="application/code" language="${language}" title="Executable ${language} Code">${code.code}</artifact>`;
      } else if (part.codeExecutionResult) {
        const result = part.codeExecutionResult;
        if (result.output) {
          textResponse += `\n\n${result.output}\n\n`;
        }
      }
    });

    let newData = data.data;
    const searchGrounding = data.candidates[0].groundingMetadata;
    if (searchGrounding) {
      if (!newData) {
        newData = {};
      }

      // Remove the searchEntryPoint renderedContent and groundingSupports from the searchGrounding
      const cleanedSearchGrounding = {
        ...searchGrounding,
        searchEntryPoint: {
          ...searchGrounding.searchEntryPoint,
          renderedContent: undefined,
        },
        groundingSupports: {},
      };

      newData.searchGrounding = cleanedSearchGrounding;
    }

    return {
      ...data,
      response: textResponse,
      data: newData,
      tool_calls: toolCalls,
    };
  }

  private static formatOllamaResponse(data: any): any {
    return { ...data, response: data.message?.content || "" };
  }

  private static async formatWorkersResponse(
    data: any,
    options: ResponseFormatOptions = {},
  ): Promise<any> {
    const type = options.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isAudioType =
      type.includes("text-to-speech") || type.includes("audio-to-text");

    if (isImageType && ((data as any).image || typeof data === "string")) {
      const imageContent = (data as any).image || (data as any);
      if (options.env) {
        const imageId = Math.random().toString(36).substring(2);
        const imageKey = `generations/${options.completion_id || "completion"}/${options.model || "model"}/${imageId}.png`;
        await uploadImageFromChat(imageContent, options.env, imageKey);
        const baseAssetsUrl = options.env.PUBLIC_ASSETS_URL || "";
        return {
          ...data,
          response: [
            {
              type: "image_url",
              image_url: { url: `${baseAssetsUrl}/${imageKey}` },
            },
          ],
          data: { url: `${baseAssetsUrl}/${imageKey}`, key: imageKey },
        };
      }
      return { ...data, response: imageContent };
    }

    if (isAudioType && ((data as any).audio || typeof data === "string")) {
      const audioContent = (data as any).audio || (data as any);
      if (options.env) {
        const audioId = Math.random().toString(36).substring(2);
        const audioKey = `generations/${options.completion_id || "completion"}/${options.model || "model"}/${audioId}.mp3`;
        await uploadAudioFromChat(audioContent, options.env, audioKey);
        const baseAssetsUrl = options.env.PUBLIC_ASSETS_URL || "";
        return {
          ...data,
          response: [
            {
              type: "audio_url",
              audio_url: { url: `${baseAssetsUrl}/${audioKey}` },
            },
          ],
          data: { url: `${baseAssetsUrl}/${audioKey}`, key: audioKey },
        };
      }
      return { ...data, response: audioContent };
    }

    if (data.response) {
      // Preprocess QwQ model responses to add missing <think> tags
      const processedResponse = ResponseFormatter.preprocessQwQResponse(data.response, options.model);
      return { ...data, response: processedResponse };
    }

    let content = data.result || "";
    // Preprocess QwQ model responses to add missing <think> tags
    content = ResponseFormatter.preprocessQwQResponse(content, options.model);

    return { ...data, response: content };
  }

  private static async formatBedrockResponse(
    data: any,
    options: ResponseFormatOptions = {},
  ): Promise<any> {
    const type = options.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isVideoType =
      type.includes("text-to-video") || type.includes("image-to-video");

    if (isVideoType) {
      return { ...data, response: data };
    }

    if (isImageType) {
      const images = (data as any).images;
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new Error("No images returned from Bedrock");
      }

      const image = images[0];
      if (options.env) {
        const imageId = Math.random().toString(36).substring(2);
        const imageKey = `generations/${options.completion_id || "completion"}/${options.model || "model"}/${imageId}.png`;
        await uploadImageFromChat(image, options.env, imageKey);
        const baseAssetsUrl = options.env.PUBLIC_ASSETS_URL || "";

        return {
          ...data,
          response: [
            {
              type: "image_url",
              image_url: { url: `${baseAssetsUrl}/${imageKey}` },
            },
          ],
          data: {
            url: `${baseAssetsUrl}/${imageKey}`,
            key: imageKey,
          },
        };
      }
      return { ...data, response: image };
    }

    if (data.output?.message?.content?.[0]?.text) {
      return { ...data, response: data.output.message.content[0].text };
    }

    if (data.delta?.text) {
      return { ...data, response: data.delta.text };
    }

    return { ...data, response: "" };
  }
}
