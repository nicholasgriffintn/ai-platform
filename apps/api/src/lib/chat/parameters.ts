import { getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { StorageService } from "~/lib/storage";
import { availableFunctions } from "~/services/functions";
import type { ChatCompletionParameters } from "~/types";
import { formatToolCalls } from "./tools";

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
  isOpenAiCompatible: boolean,
  params: ChatCompletionParameters,
  providerName: string,
  storageService?: StorageService,
  assetsUrl?: string,
): Promise<Record<string, any>> {
  if (!params) {
    throw new Error("Parameters object is required");
  }

  const finalProviderName = isOpenAiCompatible ? "compat" : providerName;

  if (!finalProviderName) {
    throw new Error("Provider name is required");
  }

  const modelName = isOpenAiCompatible
    ? `${providerName}/${params.model}`
    : params.model;

  const commonParams: Record<string, any> = {
    model: modelName,
    messages: params.messages,
    temperature: params.temperature,
  };

  if (params.version) {
    commonParams.version = params.version;
  }

  if (finalProviderName !== "anthropic") {
    commonParams.seed = params.seed;
    commonParams.repetition_penalty = params.repetition_penalty;
    commonParams.frequency_penalty = params.frequency_penalty;
    commonParams.presence_penalty = params.presence_penalty;
    commonParams.metadata = params.metadata;
  }

  let modelConfig = null;

  if (params.model) {
    try {
      modelConfig = await getModelConfigByMatchingModel(params.model);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${params.model}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to get model configuration: ${error.message}`);
    }
  }

  const provider = AIProviderFactory.getProvider(finalProviderName);

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

  if (finalProviderName === "openai") {
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
      try {
        const enabledTools = params.enabled_tools || [];
        if (params.tools) {
          const providedTools = params.tools;
          const filteredFunctions = availableFunctions
            .filter((func) => enabledTools.includes(func.name))
            .filter(
              (func) =>
                modelConfig?.supportsSearchGrounding &&
                func.name === "web_search",
            );
          const availableToolDeclarations = formatToolCalls(
            finalProviderName,
            filteredFunctions,
          );
          commonParams.tools = [...availableToolDeclarations, ...providedTools];
        } else {
          const filteredFunctions = availableFunctions.filter((func) =>
            enabledTools.includes(func.name),
          );

          commonParams.tools = formatToolCalls(
            finalProviderName,
            filteredFunctions,
          );
        }
      } catch (error: any) {
        throw new Error(`Failed to format tool calls: ${error.message}`);
      }

      if (
        params.model !== "o1" &&
        params.model !== "o3" &&
        params.model !== "o3-mini" &&
        params.model !== "o4-mini"
      ) {
        commonParams.parallel_tool_calls = params.parallel_tool_calls;
      }
      commonParams.tool_choice = params.tool_choice;
    }
  }

  if (params.model && params.should_think) {
  } else {
    commonParams.top_p = params.top_p;
  }

  try {
    switch (finalProviderName) {
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
              params.messages[0].role !== "system")
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
                  if (!storageService) {
                    throw new Error(
                      "Storage service is required for image URL processing",
                    );
                  }

                  if (!assetsUrl) {
                    throw new Error(
                      "Assets URL is required for image URL processing",
                    );
                  }

                  const imageKeyFromUrl = imageContent.replace(assetsUrl, "");
                  const imageData =
                    await storageService?.getObject(imageKeyFromUrl);
                  base64Data = imageData;
                } else {
                  base64Data = imageContent;
                }

                if (!base64Data) {
                  throw new Error("No image data found");
                }

                try {
                  const binary = atob(base64Data);
                  const array = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) {
                    array[i] = binary.charCodeAt(i);
                  }

                  if (array.length === 0) {
                    throw new Error("No image data found after processing");
                  }
                  imageData = Array.from(array);
                } catch (binaryError: any) {
                  throw new Error(
                    `Failed to process image data: ${binaryError.message}`,
                  );
                }
              }
            } else {
              imageData = imageContent;
            }
          } catch (error: any) {
            throw new Error(`Error processing image data: ${error.message}`);
          }

          let prompt = null;

          if (
            params.messages.length >= 2 &&
            params.messages[0].role === "system"
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
      case "openai":
      case "compat": {
        const tools = [];
        if (modelConfig?.supportsFunctions) {
          if (
            modelConfig?.supportsSearchGrounding &&
            params.enabled_tools.includes("search_grounding")
          ) {
            tools.push({ type: "web_search_preview" });
          }
        }
        const allTools = [...tools, ...(commonParams.tools || [])];
        const newCommonParams: Partial<ChatCompletionParameters> = {
          ...commonParams,
        };
        if (modelConfig?.supportsFunctions && tools.length > 0) {
          newCommonParams.tools = allTools;
        }
        const supportsThinking = modelConfig?.hasThinking || false;
        if (supportsThinking) {
          newCommonParams.reasoning_effort = params.reasoning_effort;
        }
        if (params.model === "o1" || params.model === "o4-mini") {
          newCommonParams.temperature = 1;
          newCommonParams.top_p = undefined;
        }
        if (params.model.includes("-search-preview")) {
          newCommonParams.frequency_penalty = undefined;
          newCommonParams.presence_penalty = undefined;
          newCommonParams.temperature = undefined;
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

        if (finalProviderName === "compat") {
          return newCommonParams;
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
        const tools = [];
        if (modelConfig?.supportsFunctions) {
          if (
            modelConfig?.supportsSearchGrounding &&
            params.enabled_tools.includes("search_grounding")
          ) {
            tools.push({
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
            });
          }
          if (
            modelConfig?.supportsCodeExecution &&
            params.enabled_tools.includes("code_execution")
          ) {
            tools.push({
              type: "code_execution_20250522",
              name: "code_execution",
            });
          }
        }
        const allTools = [...tools, ...(commonParams.tools || [])];
        const newCommonParams: Partial<ChatCompletionParameters> = {
          ...commonParams,
        };
        if (modelConfig?.supportsFunctions && tools.length > 0) {
          newCommonParams.tools = allTools;
        }
        const supportsThinking = modelConfig?.hasThinking || false;

        if (supportsThinking) {
          if (newCommonParams.max_tokens <= 1024) {
            newCommonParams.max_tokens = 1025;
          }
          newCommonParams.thinking = {
            type: "enabled",
            budget_tokens: calculateReasoningBudget(params),
          };
          newCommonParams.top_p = undefined;
          newCommonParams.temperature = 1;
        }
        return {
          ...newCommonParams,
          system: params.system_prompt,
          stop_sequences: params.stop,
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
        const hasEnabledExclusiveTools =
          enabledTools.includes("code_execution") ||
          enabledTools.includes("search_grounding");
        if (
          modelConfig?.supportsFunctions &&
          !hasEnabledExclusiveTools &&
          commonParams.tools?.length > 0
        ) {
          const formattedTools = commonParams.tools.map((tool) => ({
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
          model: modelName,
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
                  : Array.isArray(
                        params.messages[params.messages.length - 1].content,
                      )
                    ? (
                        params.messages[params.messages.length - 1]
                          .content[0] as any
                      )?.text || ""
                    : "",
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
                  : Array.isArray(
                        params.messages[params.messages.length - 1].content,
                      )
                    ? (
                        params.messages[params.messages.length - 1]
                          .content[0] as any
                      )?.text || ""
                    : "",
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
  } catch (error: any) {
    throw new Error(
      `Error mapping parameters for provider ${finalProviderName}: ${error.message}`,
    );
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
      return Math.max(Math.floor(params.max_tokens * 0.5), 1024);
    case "medium":
      return Math.max(Math.floor(params.max_tokens * 0.75), 1024);
    case "high":
      return Math.max(Math.floor(params.max_tokens * 0.9), 1024);
    default:
      return Math.max(Math.floor(params.max_tokens * 0.75), 1024);
  }
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
