import { getModelConfigByMatchingModel } from "~/lib/models";
import type { StorageService } from "~/lib/storage";
import { AIProviderFactory } from "~/providers/factory";
import { availableFunctions } from "~/services/functions";
import type { ChatCompletionParameters } from "~/types";
import { getLogger } from "~/utils/logger";
import { formatToolCalls } from "./tools";

const logger = getLogger({ prefix: "CHAT_PARAMETERS" });

/**
 * Merges default parameters with user-provided parameters
 * @param params - The user-provided parameters
 * @param defaults - The default parameters
 * @returns The merged parameters
 */
export function mergeParametersWithDefaults(
  params: Partial<ChatCompletionParameters>,
  defaults: Partial<ChatCompletionParameters> = {},
): ChatCompletionParameters {
  return {
    ...defaults,
    ...params,
    rag_options: {
      ...defaults.rag_options,
      ...params.rag_options,
    },
  } as ChatCompletionParameters;
}

/**
 * Provider-specific parameter transformations
 * @param params - The chat completion parameters
 * @param providerName - The name of the provider
 * @param storageService - The storage service
 * @param assetsUrl - The assets URL
 * @returns The provider-specific parameters
 */
export async function mapParametersToProvider(
  params: ChatCompletionParameters,
  providerName: string,
  storageService?: StorageService,
  assetsUrl?: string,
): Promise<Record<string, any>> {
  const commonParams: Record<string, any> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
  };

  if (params.version) {
    commonParams.version = params.version;
  }

  if (providerName !== "anthropic") {
    commonParams.seed = params.seed;
    commonParams.repetition_penalty = params.repetition_penalty;
    commonParams.frequency_penalty = params.frequency_penalty;
    commonParams.presence_penalty = params.presence_penalty;
    commonParams.metadata = params.metadata;
  }

  let modelConfig = null;

  if (params.model) {
    modelConfig = getModelConfigByMatchingModel(params.model);
  }

  const provider = AIProviderFactory.getProvider(providerName);

  const modelTypeIsText = modelConfig?.type?.includes("text");
  const modelTypeIsCoding = modelConfig?.type?.includes("coding");
  const modelTypeSupportsStreaming = modelTypeIsText || modelTypeIsCoding;
  if (
    params.stream &&
    provider.supportsStreaming &&
    modelTypeSupportsStreaming
  ) {
    commonParams.stream = true;
  }

  if (providerName === "openai") {
    commonParams.max_completion_tokens = params.max_tokens || 4096;
  } else {
    const modelMaxTokens = modelConfig?.maxTokens || 4096;
    if (modelMaxTokens < params.max_tokens) {
      commonParams.max_tokens = modelMaxTokens;
    } else {
      commonParams.max_tokens = params.max_tokens || modelMaxTokens;
    }
  }

  if (params.model && params.response_format) {
    const supportsResponseFormat = modelConfig?.supportsResponseFormat || false;
    if (supportsResponseFormat) {
      commonParams.response_format = params.response_format;
    }
  }

  if (
    params.model &&
    !params.disable_functions &&
    !commonParams.response_format
  ) {
    const supportsFunctions = modelConfig?.supportsFunctions || false;

    if (supportsFunctions) {
      if (params.tools) {
        return {
          ...commonParams,
          tools: params.tools,
        };
      }

      const enabledTools = params.enabled_tools || [];
      const filteredFunctions = availableFunctions.filter((func) =>
        enabledTools.includes(func.name),
      );

      commonParams.tools = formatToolCalls(providerName, filteredFunctions);
    }
  }

  if (params.model && params.should_think) {
  } else {
    commonParams.top_p = params.top_p;
  }

  switch (providerName) {
    case "workers-ai": {
      const type = modelConfig?.type || ["text"];

      let imageData;
      if (
        type.includes("image-to-text") ||
        type.includes("image-to-image") ||
        type.includes("image-to-text") ||
        type.includes("text-to-image") ||
        type.includes("text-to-speech")
      ) {
        if (
          params.messages.length > 2 ||
          (params.messages.length === 2 &&
            params.messages[0].role !== ("system" as any))
        ) {
          return null;
        }

        try {
          const imageContent =
            Array.isArray(params.messages[0].content) &&
            params.messages[0].content[1] &&
            "image_url" in params.messages[0].content[1]
              ? // @ts-ignore - types of wrong
                params.messages[0].content[1].image_url.url
              : // @ts-ignore - types of wrong
                params.messages[0].content?.image;

          if (imageContent) {
            const isUrl = imageContent.startsWith("http");

            if (type.includes("image-to-text")) {
              let base64Data = null;
              if (isUrl) {
                const imageKeyFromUrl = imageContent.replace(assetsUrl, "");
                const imageData =
                  await storageService?.getObject(imageKeyFromUrl);
                base64Data = imageData;
              } else {
                base64Data = imageContent;
              }

              if (!base64Data) {
                logger.error("No image data found");
                imageData = null;
              } else {
                const binary = atob(base64Data);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  array[i] = binary.charCodeAt(i);
                }

                if (array.length === 0) {
                  logger.error("No image data found");
                  imageData = null;
                } else {
                  imageData = Array.from(array);
                }
              }
            } else {
              imageData = imageContent;
            }
          }
        } catch (error) {
          logger.error("Error getting image data", { error });
          imageData = null;
        }

        let prompt = null;

        if (
          params.messages.length >= 2 &&
          params.messages[0].role === ("system" as any)
        ) {
          let systemContent = "";
          if (Array.isArray(params.messages[0].content)) {
            const contentItem = params.messages[0].content[0];
            if (contentItem && typeof contentItem === "object") {
              if (contentItem.type === "text" && contentItem.text) {
                systemContent = contentItem.text;
              } else if ("text" in contentItem) {
                systemContent = contentItem.text;
              }
            }
          } else if (typeof params.messages[0].content === "string") {
            systemContent = params.messages[0].content;
          } else {
            // @ts-ignore - types might be wrong
            systemContent = params.messages[0].content?.text || "";
          }

          let userContent = "";
          if (Array.isArray(params.messages[1].content)) {
            const contentItem = params.messages[1].content[0];
            if (contentItem && typeof contentItem === "object") {
              if (contentItem.type === "text" && contentItem.text) {
                userContent = contentItem.text;
              } else if ("text" in contentItem) {
                userContent = contentItem.text;
              }
            }
          } else if (typeof params.messages[1].content === "string") {
            userContent = params.messages[1].content;
          } else {
            // @ts-ignore - types might be wrong
            userContent = params.messages[1].content?.text || "";
          }

          prompt = `${systemContent}\n\n${userContent}`;
        } else {
          if (Array.isArray(params.messages[0].content)) {
            const contentItem = params.messages[0].content[0];
            if (contentItem && typeof contentItem === "object") {
              if (contentItem.type === "text" && contentItem.text) {
                prompt = contentItem.text;
              } else if ("text" in contentItem) {
                prompt = contentItem.text;
              }
            }
          } else if (typeof params.messages[0].content === "string") {
            prompt = params.messages[0].content;
          } else {
            // @ts-ignore - types might be wrong
            prompt = params.messages[0].content?.text;
          }
        }

        if (!prompt) {
          logger.error("No prompt found");
          return {
            prompt: "",
            image: imageData,
          };
        }

        return {
          prompt,
          image: imageData,
        };
      }

      return {
        ...commonParams,
        stop: params.stop,
        n: params.n,
        random_seed: params.seed,
        messages: params.messages,
      };
    }
    case "openai": {
      const newCommonParams = {
        ...commonParams,
      };
      const supportsThinking = modelConfig?.hasThinking || false;
      if (supportsThinking) {
        newCommonParams.reasoning_effort = params.reasoning_effort;
      }
      if (params.model === "o1") {
        newCommonParams.temperature = 1;
        newCommonParams.top_p = undefined;
      }

      const type = modelConfig?.type || ["text"];
      if (type.includes("image-to-image") || type.includes("text-to-image")) {
        let prompt = "";
        if (params.messages.length > 1) {
          const content = params.messages[1].content;
          prompt =
            typeof content === "string" ? content : content[0]?.text || "";
        } else {
          const content = params.messages[0].content;
          prompt =
            typeof content === "string" ? content : content[0]?.text || "";
        }

        const hasImages = params.messages.some(
          (message) =>
            typeof message.content !== "string" &&
            message.content.some((item: any) => item.type === "image_url"),
        );

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
        ...newCommonParams,
        store: params.store,
        logit_bias: params.logit_bias,
        n: params.n,
        stop: params.stop,
        user:
          typeof params.user === "string" ? params.user : params.user?.email,
      };
    }
    case "anthropic": {
      const newCommonParams = {
        ...commonParams,
      };
      const supportsThinking = modelConfig?.hasThinking || false;
      if (supportsThinking) {
        newCommonParams.thinking = {
          type: "enabled",
          budget_tokens: calculateReasoningBudget(params),
        };
        newCommonParams.top_p = undefined;
      }
      return {
        ...newCommonParams,
        system: params.system_prompt,
        stop_sequences: params.stop,
      };
    }
    case "deepseek": {
      return {
        ...commonParams,
        messages: formatDeepSeekMessages(params),
      };
    }
    case "google-ai-studio":
    case "googlestudio": {
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
      /* if (modelConfig?.supportsFunctions) {
        tools.push({
          function_declarations: commonParams.tools,
        });
      } */

      return {
        model: params.model,
        contents: formatGoogleStudioContents(params),
        tools: modelConfig?.supportsFunctions ? tools : undefined,
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
          maxOutputTokens: params.max_tokens,
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
    case "bedrock": {
      const type = modelConfig?.type || ["text"];
      const isImageType =
        type.includes("text-to-image") || type.includes("image-to-image");
      const isVideoType =
        type.includes("text-to-video") || type.includes("image-to-video");

      if (isVideoType) {
        return {
          messages: formatBedrockMessages(params),
          taskType: "TEXT_VIDEO",
          textToVideoParams: {
            text:
              typeof params.messages[params.messages.length - 1].content ===
              "string"
                ? params.messages[params.messages.length - 1].content
                : // @ts-ignore
                  params.messages[params.messages.length - 1].content[0].text ||
                  "",
          },
          videoGenerationConfig: {
            durationSeconds: 6,
            fps: 24,
            dimension: "1280x720",
          },
        };
      }

      if (isImageType) {
        return {
          textToImageParams: {
            text:
              typeof params.messages[params.messages.length - 1].content ===
              "string"
                ? params.messages[params.messages.length - 1].content
                : // @ts-ignore
                  params.messages[params.messages.length - 1].content[0].text ||
                  "",
          },
          taskType: "TEXT_IMAGE",
          imageGenerationConfig: {
            quality: "standard",
            width: 1280,
            height: 1280,
            numberOfImages: 1,
          },
        };
      }

      const supportsFunctions = modelConfig?.supportsFunctions || false;

      return {
        ...(commonParams.system_prompt && {
          system: [{ text: commonParams.system_prompt }],
        }),
        messages: formatBedrockMessages(params),
        inferenceConfig: {
          temperature: commonParams.temperature,
          maxTokens: commonParams.max_tokens,
          topP: commonParams.top_p,
        },
        ...(supportsFunctions && {
          toolConfig: {
            tools: commonParams.tools,
          },
        }),
      };
    }
    default:
      return commonParams;
  }
}

/**
 * Helper function to calculate reasoning budget based on reasoning_effort
 * @param params - The chat completion parameters
 * @returns The reasoning budget
 */
function calculateReasoningBudget(params: ChatCompletionParameters): number {
  if (!params.max_tokens) return 1024;

  switch (params.reasoning_effort) {
    case "low":
      return Math.floor(params.max_tokens * 0.5);
    case "medium":
      return Math.floor(params.max_tokens * 0.75);
    case "high":
      return Math.floor(params.max_tokens * 0.9);
    default:
      return Math.floor(params.max_tokens * 0.75);
  }
}

/**
 * Format messages for DeepSeek models
 * @param params - The chat completion parameters
 * @returns The formatted messages
 */
function formatDeepSeekMessages(params: ChatCompletionParameters): any[] {
  return params.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/**
 * Format messages for Google Studio models
 * @param params - The chat completion parameters
 * @returns The formatted messages
 */
function formatGoogleStudioContents(params: ChatCompletionParameters): any[] {
  const contents = [];

  // biome-ignore lint/complexity/noForEach: It Works.
  params.messages.forEach((message) => {
    contents.push({
      role: message.role === "assistant" ? "model" : message.role,
      parts: message.parts,
    });
  });

  return contents;
}

/**
 * Format messages for Bedrock models
 * @param params - The chat completion parameters
 * @returns The formatted messages
 */
function formatBedrockMessages(params: ChatCompletionParameters): any[] {
  return params.messages.map((message) => ({
    role: message.role,
    content: [
      {
        type: "text",
        text: message.content,
      },
    ],
  }));
}
