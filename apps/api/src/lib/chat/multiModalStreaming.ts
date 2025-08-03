import { getAIResponse } from "~/lib/chat/responses";
import type { ConversationManager } from "~/lib/conversationManager";
import type {
  ChatMode,
  IEnv,
  IUser,
  IUserSettings,
  ModelConfigInfo,
  Platform,
} from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { createStreamWithPostProcessing } from "./streaming";

const logger = getLogger({ prefix: "CHAT:MULTI_MODEL_STREAMING" });

/**
 * Creates a multi-model stream that queries multiple models and combines their responses
 * @param parameters - The parameters
 * @param options - The options
 * @param conversationManager - The conversation manager
 * @returns The multi-model stream
 */
export function createMultiModelStream(
  parameters: any,
  options: {
    env: IEnv;
    completion_id: string;
    model: string;
    provider: string;
    platform?: Platform;
    user?: IUser;
    userSettings?: IUserSettings;
    app_url?: string;
    mode?: ChatMode;
    tools?: any[];
    enabled_tools?: string[];
  },
  conversationManager: ConversationManager,
): ReadableStream {
  logger.debug("Starting multi-model stream", {
    completion_id: options.completion_id,
    models: parameters.models.map((m: ModelConfigInfo) => m.model),
  });
  const { models, ...baseParams } = parameters;
  logger.debug("Primary model request", { model: models[0].model });
  const primaryParams = {
    ...baseParams,
    model: models[0].model,
    stream: true,
  };

  const primaryResponsePromise = getAIResponse(primaryParams);

  const secondaryPromises =
    models.length > 1
      ? models.slice(1).map(async (modelConfig: ModelConfigInfo) => {
          logger.info("Secondary model request", { model: modelConfig.model });

          const secondaryParams = {
            ...baseParams,
            model: modelConfig.model,
            stream: false,
          };

          try {
            const response = await getAIResponse(secondaryParams);

            if (!(response instanceof ReadableStream)) {
              const encoder = new TextEncoder();
              const responseText = response.response || "";
              const modelName = modelConfig.displayName;
              const modelResponse = `${responseText}`;

              return new ReadableStream({
                start(controller) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "content_block_delta",
                        content: modelResponse,
                        modelName: modelName,
                      })}\n\n`,
                    ),
                  );
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                },
              });
            }

            return response;
          } catch (error) {
            logger.error(
              `Error getting response from secondary model ${modelConfig.model}`,
              { error },
            );

            return new ReadableStream({
              start(controller) {
                controller.close();
              },
            });
          }
        })
      : [];

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let primaryContent = "";
      let modelHeader = "";

      try {
        const usageLimits = await conversationManager.getUsageLimits();
        if (usageLimits) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "usage_limits",
                usage_limits: usageLimits,
              })}\n\n`,
            ),
          );
        }
      } catch (error) {
        logger.error(
          "Failed to get usage limits for multi-model streaming:",
          error,
        );
      }

      try {
        const primaryResponse = await primaryResponsePromise;
        if (!(primaryResponse instanceof ReadableStream)) {
          throw new Error("Primary model response is not a stream");
        }

        const primaryProcessedStream = await createStreamWithPostProcessing(
          primaryResponse,
          { ...options, model: models[0].model },
          conversationManager,
        );

        const primaryReader = primaryProcessedStream.getReader();

        const modelNames = models
          .map((m: ModelConfigInfo) => m.displayName)
          .join(", ");
        modelHeader = `Using the following models: ${modelNames}\n\n`;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "content_block_delta",
              content: modelHeader,
            })}\n\n`,
          ),
        );

        while (true) {
          const { done, value } = await primaryReader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          try {
            const matches = text.match(/data: (.*?)\n\n/g);
            if (matches) {
              for (const match of matches) {
                const dataStr = match.substring(6, match.length - 2);
                if (dataStr === "[DONE]") continue;
                let data;
                try {
                  data = JSON.parse(dataStr);
                } catch (e) {
                  throw new Error("Failed to parse data");
                }
                if (data.type === "content_block_delta" && data.content) {
                  primaryContent += data.content;
                } else if (data.type === "text" && data.text) {
                  primaryContent += data.text;
                }
              }
            }
          } catch (e) {
            /* ignore parse errors during capture */
          }

          controller.enqueue(value);
        }
      } catch (error) {
        logger.error(
          "Error processing primary stream in multi-model setup:",
          error,
        );
        controller.error(error);
        return;
      }

      let secondaryContent = "";
      try {
        const secondaryResponses = await Promise.all(secondaryPromises);
        let secondaryIndex = 0;

        for (const secondaryStream of secondaryResponses) {
          const modelConfig = models[secondaryIndex + 1];
          const modelName = modelConfig?.displayName || "Secondary model";

          const divider = `\n\n***\n### ${modelName} response\n\n`;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "content_block_delta", content: divider })}\n\n`,
            ),
          );
          secondaryContent += divider;

          const secondaryReader = secondaryStream.getReader();
          while (true) {
            const { done, value } = await secondaryReader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            try {
              const matches = text.match(/data: (.*?)\n\n/g);
              if (matches) {
                for (const match of matches) {
                  const dataStr = match.substring(6, match.length - 2);
                  if (dataStr === "[DONE]") continue;
                  let data;
                  try {
                    data = JSON.parse(dataStr);
                  } catch (e) {
                    throw new Error("Failed to parse data");
                  }
                  if (data.type === "content_block_delta" && data.content) {
                    secondaryContent += data.content;
                    const deltaEvent = encoder.encode(
                      `data: ${JSON.stringify({
                        type: "content_block_delta",
                        content: data.content,
                      })}\n\n`,
                    );
                    controller.enqueue(deltaEvent);
                  } else {
                    controller.enqueue(value);
                  }
                }
              } else {
                controller.enqueue(value);
              }
            } catch (e) {
              controller.enqueue(value);
            }
          }
          secondaryIndex++;
        }
      } catch (error) {
        logger.error("Error processing secondary streams:", {
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        });

        const errorMessage =
          "\n\n***\n### Error processing additional model responses\n\nThere was an error processing responses from secondary models. Only the primary model response is available.\n\n";

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "content_block_delta",
              content: errorMessage,
              isError: true,
            })}\n\n`,
          ),
        );

        secondaryContent += errorMessage;
      }

      try {
        const conversation = await conversationManager.get(
          options.completion_id,
        );
        if (conversation?.length > 0) {
          const assistantMessages = conversation.filter(
            (msg) => msg.role === "assistant",
          );
          if (assistantMessages.length > 0) {
            const lastMessage = assistantMessages[assistantMessages.length - 1];
            let storedPrimaryContent = "";
            if (typeof lastMessage.content === "string") {
              storedPrimaryContent = lastMessage.content;
            } else if (Array.isArray(lastMessage.content)) {
              const textBlock = lastMessage.content.find(
                (block) => block.type === "text",
              );
              storedPrimaryContent = textBlock?.text || "";
            }

            const finalCombinedContent =
              modelHeader + storedPrimaryContent + secondaryContent;

            await conversationManager.update(options.completion_id, [
              {
                ...lastMessage,
                content: finalCombinedContent,
                data: {
                  ...lastMessage.data,
                  includesSecondaryModels: true,
                  secondaryModels:
                    models.slice(1).map((m: ModelConfigInfo) => m.model) || [],
                },
              },
            ]);
          } else {
            const finalCombinedContentForAdd =
              modelHeader + primaryContent + secondaryContent;
            await conversationManager.add(options.completion_id, {
              role: "assistant",
              content: finalCombinedContentForAdd,
              citations: [],
              log_id: null,
              mode: options.mode,
              id: generateId(),
              timestamp: Date.now(),
              model: models[0].model,
              platform: options.platform || "api",
              usage: null,
              data: {
                includesSecondaryModels: true,
                secondaryModels:
                  models.slice(1).map((m: ModelConfigInfo) => m.model) || [],
              },
              tool_calls: null,
            });
          }
        }

        try {
          const updatedUsageLimits = await conversationManager.getUsageLimits();
          if (updatedUsageLimits) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "usage_limits",
                  usage_limits: updatedUsageLimits,
                })}\n\n`,
              ),
            );
          }
        } catch (error) {
          logger.error(
            "Failed to get updated usage limits for multi-model streaming:",
            error,
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        logger.error("Error during finalization/storage:", {
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        });
        controller.error(error);
      }
    },
    cancel(reason) {
      logger.warn("Multi-model stream cancelled", {
        reason,
        completion_id: options.completion_id,
      });
    },
  });
}
