import { preprocessQwQResponse } from "~/lib/chat/utils/qwq";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { StorageService } from "../storage";
import { uploadAudioFromChat, uploadImageFromChat } from "../upload";

interface ResponseFormatOptions {
  model?: string;
  type?: string[];
  env?: IEnv;
  completion_id?: string;
  is_streaming?: boolean;
}

// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class ResponseFormatter {
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
      replicate: ResponseFormatter.formatReplicateResponse,
    };

    return formatters[provider] || ResponseFormatter.formatGenericResponse;
  }

  private static collectStringsFromOutput(output: unknown): string[] {
    if (typeof output === "string") {
      return [output];
    }

    if (Array.isArray(output)) {
      return output.flatMap((item) =>
        ResponseFormatter.collectStringsFromOutput(item),
      );
    }

    if (output && typeof output === "object") {
      return Object.values(output).flatMap((value) =>
        ResponseFormatter.collectStringsFromOutput(value),
      );
    }

    return [];
  }

  private static filterUrlsByExtension(
    urls: string[],
    extensions: string[],
  ): string[] {
    return urls.filter((url) => {
      const normalized = url.split("?")[0].toLowerCase();
      return extensions.some((extension) => normalized.endsWith(extension));
    });
  }

  private static getExtensionFromUrl(url: string, fallback: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.toLowerCase();
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      if (match?.[1]) {
        return match[1];
      }
    } catch (_error) {
      const sanitized = url.split("?")[0];
      const match = sanitized.match(/\.([a-z0-9]+)$/i);
      if (match?.[1]) {
        return match[1];
      }
    }

    return fallback;
  }

  private static getContentTypeFromExtension(
    extension: string,
    fallback: string,
  ): string {
    const mapping: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
      flac: "audio/flac",
    };

    return mapping[extension] || fallback;
  }

  private static buildAssetKey(
    options: ResponseFormatOptions,
    extension: string,
  ): string {
    const completion = options.completion_id || "completion";
    const model = options.model || "model";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `generations/${completion}/${model}/${unique}.${extension}`;
  }

  private static async persistRemoteAssets(
    assetUrls: string[],
    options: ResponseFormatOptions,
    fallback: { extension: string; contentType: string },
  ): Promise<{
    urls: string[];
    metadata: Array<{ key: string; url: string; originalUrl: string }>;
  }> {
    if (!assetUrls.length) {
      return { urls: [], metadata: [] };
    }

    const env = options.env;
    if (!env?.ASSETS_BUCKET) {
      throw new AssistantError(
        "ASSETS_BUCKET is not set",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const storageService = new StorageService(env.ASSETS_BUCKET);
    const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";

    const uploads = await Promise.all(
      assetUrls.map(async (assetUrl) => {
        const response = await fetch(assetUrl);
        if (!response.ok) {
          throw new AssistantError(
            `Failed to fetch asset from ${assetUrl}`,
            ErrorType.PROVIDER_ERROR,
            response.status,
          );
        }

        const buffer = await response.arrayBuffer();
        const extension = ResponseFormatter.getExtensionFromUrl(
          assetUrl,
          fallback.extension,
        );
        const contentType = ResponseFormatter.getContentTypeFromExtension(
          extension,
          fallback.contentType,
        );
        const key = ResponseFormatter.buildAssetKey(options, extension);

        await storageService.uploadObject(key, buffer, {
          contentType,
          contentLength: buffer.byteLength,
        });

        const persistedUrl = baseAssetsUrl ? `${baseAssetsUrl}/${key}` : key;

        return {
          key,
          url: persistedUrl,
          originalUrl: assetUrl,
        };
      }),
    );

    return {
      urls: uploads.map((upload) => upload.url),
      metadata: uploads,
    };
  }

  private static async uploadImages(
    imageUrls: string[],
    options: ResponseFormatOptions,
  ): Promise<any> {
    const env = options.env;

    if (!env?.ASSETS_BUCKET) {
      throw new AssistantError(
        "ASSETS_BUCKET is not set",
        ErrorType.CONFIGURATION_ERROR,
      );
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
  private static formatGenericResponse(
    data: any,
    options: ResponseFormatOptions,
  ): any {
    if (data.response !== undefined) {
      return data;
    }

    let textContent = "";
    let thinkingContent = "";
    let signatureContent = "";

    if (data.choices?.[0]) {
      if (data.choices[0].message?.content) {
        textContent = data.choices[0].message.content;
      } else if (data.choices[0].delta?.content !== undefined) {
        textContent = data.choices[0].delta.content;
      } else if (data.choices[0].text) {
        textContent = data.choices[0].text;
      }
    } else if (data.delta?.text) {
      textContent = data.delta.text;
    } else if (data.content && typeof data.content === "string") {
      textContent = data.content;
    } else if (data.content && Array.isArray(data.content)) {
      textContent = data.content
        .filter((item: any) => item.type === "text" && item.text)
        .map((item: any) => item.text)
        .join(" ");

      const thinkingContentItem = data.content.find(
        (item: any) => item.type === "thinking" && item.thinking,
      );

      thinkingContent = thinkingContentItem?.thinking || "";
      signatureContent = thinkingContentItem?.signature || "";
    } else if (data.message?.content) {
      if (typeof data.message.content === "string") {
        textContent = data.message.content;
      } else if (Array.isArray(data.message.content)) {
        textContent = data.message.content
          .filter((item: any) => item.type === "text" && item.text)
          .map((item: any) => item.text)
          .join(" ");

        const thinkingContentItem = data.message.content.find(
          (item: any) => item.type === "thinking" && item.thinking,
        );

        thinkingContent = thinkingContentItem?.thinking || "";
        signatureContent = thinkingContentItem?.signature || "";
      }
    }

    const processedTextContent = !options.is_streaming
      ? preprocessQwQResponse(textContent, options.model || data.model || "")
      : textContent;

    return {
      ...data,
      response: processedTextContent,
      thinking: thinkingContent,
      signature: signatureContent,
    };
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
    const textContent = message?.content || "";

    const processedTextContent = !options.is_streaming
      ? preprocessQwQResponse(textContent, options.model || data.model || "")
      : textContent;

    return { ...data, response: processedTextContent, ...message };
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

    let textContent = "";
    if (data.response) {
      textContent = data.response;
    } else {
      textContent = data.result || "";
    }

    const processedTextContent = !options.is_streaming
      ? preprocessQwQResponse(textContent, options.model || data.model || "")
      : textContent;

    return { ...data, response: processedTextContent };
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
        throw new AssistantError(
          "No images returned from Bedrock",
          ErrorType.PROVIDER_ERROR,
        );
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

    if (typeof data.message === "string") {
      return { ...data, response: data.message };
    }

    return { ...data, response: "" };
  }

  private static async formatReplicateResponse(
    data: any,
    options: ResponseFormatOptions = {},
  ): Promise<any> {
    const output =
      data?.output ??
      data?.prediction?.output ??
      data?.data?.output ??
      data?.response ??
      [];

    const strings = ResponseFormatter.collectStringsFromOutput(output).map(
      (value) => value.trim(),
    );
    const urlStrings = strings.filter((value) =>
      value.toLowerCase().startsWith("http"),
    );
    const textStrings = strings.filter(
      (value) => !value.toLowerCase().startsWith("http") && value,
    );

    const types = new Set(options.type || []);
    const isImageType =
      types.has("text-to-image") || types.has("image-to-image");
    const isVideoType =
      types.has("text-to-video") || types.has("image-to-video");
    const isAudioType =
      types.has("text-to-audio") ||
      types.has("audio-to-audio") ||
      types.has("audio-generation");
    const isTranscriptionType = types.has("audio-to-text");

    if (isImageType) {
      const imageUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
      ]);
      const candidateUrls = imageUrls.length ? imageUrls : urlStrings;
      if (!candidateUrls.length) {
        const fallbackText = textStrings.join("\n").trim();
        return { ...data, response: fallbackText };
      }

      let persistedUrls = candidateUrls;
      let metadata: Array<{ key: string; url: string; originalUrl: string }> =
        [];

      if (options.env?.ASSETS_BUCKET) {
        const uploads = await ResponseFormatter.persistRemoteAssets(
          candidateUrls,
          options,
          { extension: "png", contentType: "image/png" },
        );
        persistedUrls = uploads.urls;
        metadata = uploads.metadata;
      }

      const responseContent = persistedUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      }));

      const result: any = { ...data, response: responseContent };
      if (metadata.length) {
        result.data = { ...(data.data || {}), assets: metadata };
      }
      return result;
    }

    if (isVideoType) {
      const videoUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
        ".mp4",
        ".webm",
        ".mov",
      ]);
      const candidateUrls = videoUrls.length ? videoUrls : urlStrings;
      if (!candidateUrls.length) {
        const fallbackText = textStrings.join("\n").trim();
        return { ...data, response: fallbackText };
      }

      let persistedUrls = candidateUrls;
      let metadata: Array<{ key: string; url: string; originalUrl: string }> =
        [];

      if (options.env?.ASSETS_BUCKET) {
        const uploads = await ResponseFormatter.persistRemoteAssets(
          candidateUrls,
          options,
          { extension: "mp4", contentType: "video/mp4" },
        );
        persistedUrls = uploads.urls;
        metadata = uploads.metadata;
      }

      const responseContent = persistedUrls.map((url) => ({
        type: "video_url" as const,
        video_url: { url },
      }));

      const result: any = { ...data, response: responseContent };
      if (metadata.length) {
        result.data = { ...(data.data || {}), assets: metadata };
      }
      return result;
    }

    if (isAudioType) {
      const audioUrls = ResponseFormatter.filterUrlsByExtension(urlStrings, [
        ".mp3",
        ".wav",
        ".ogg",
        ".flac",
        ".m4a",
      ]);
      const candidateUrls = audioUrls.length ? audioUrls : urlStrings;
      if (!candidateUrls.length) {
        const fallbackText = textStrings.join("\n").trim();
        return { ...data, response: fallbackText };
      }

      let persistedUrls = candidateUrls;
      let metadata: Array<{ key: string; url: string; originalUrl: string }> =
        [];

      if (options.env?.ASSETS_BUCKET) {
        const uploads = await ResponseFormatter.persistRemoteAssets(
          candidateUrls,
          options,
          { extension: "mp3", contentType: "audio/mpeg" },
        );
        persistedUrls = uploads.urls;
        metadata = uploads.metadata;
      }

      const responseContent = persistedUrls.map((url) => ({
        type: "audio_url" as const,
        audio_url: { url },
      }));

      const result: any = { ...data, response: responseContent };
      if (metadata.length) {
        result.data = { ...(data.data || {}), assets: metadata };
      }
      return result;
    }

    const textCandidate = textStrings.join("\n").trim();
    if (isTranscriptionType || textCandidate) {
      return { ...data, response: textCandidate };
    }

    if (urlStrings.length) {
      const responseContent = urlStrings.map((url) => ({
        type: "text" as const,
        text: url,
      }));
      return { ...data, response: responseContent };
    }

    return { ...data, response: "" };
  }
}
