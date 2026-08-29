import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { readCompactionStatusMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import {
  getMessageTextContent,
  normalizeMessage,
} from "@ngriffin_uk/polychat-library-chat/messages";
import { normalizeSelectedModel } from "@ngriffin_uk/polychat-library-chat/model-selection";
import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { updateConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { EMPTY_MODEL_CONFIG, getModelProvider } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { CHATS_QUERY_KEY } from "~/constants";
import { GOAL_QUERY_KEY } from "~/hooks/useGoal";
import { apiService } from "~/lib/api/api-service";
import { getChatStreamLoadingMessage } from "~/lib/chat/stream-state";
import { recoverDetachedTurn } from "~/lib/chat/turn-recovery";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { normaliseUsageLimits } from "~/lib/usage-limits";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";
import { useUsageStore } from "~/state/stores/usageStore";
import type { ChatRequestOptions, Conversation, Message } from "~/types";

import { useMessageOperations } from "./useMessageOperations";
import { useModels } from "./useModels";

export interface StreamResponseOptions {
  assistantMessageData?: Partial<Message>;
  generateTitle?: boolean;
  model?: string;
  models?: string[];
}

/**
 * Hook for managing streaming responses and abort control.
 * Handles both local WebLLM and remote API streaming.
 */
export function useStreamingResponse(
  webLLMService: any,
  onTitleGeneration?: (conversationId: string, messages: Message[]) => Promise<void>,
  requestOptions?: ChatRequestOptions,
) {
  const queryClient = useQueryClient();
  const { stopLoading, updateLoading } = useLoadingActions();
  const {
    chatMode,
    model,
    chatSettings,
    isAuthenticated,
    isPro,
    localOnlyMode,
    useMultiModel,
    autoMode,
    selectedAgentId,
    markConversationRemoteAvailable,
    setModel,
    user,
  } = useChatStore();
  const setUsageLimits = useUsageStore((state) => state.setUsageLimits);
  const {
    beginStreamActivity,
    completeStreamActivityMessage,
    endStreamActivity,
    recordStreamActivityState,
    recordStreamActivityText,
    recordStreamActivityToolResult,
  } = useStreamActivityStore.getState();

  const [streamStarted, setStreamStarted] = useState(false);
  const [controller, setController] = useState(() => new AbortController());
  const controllerRef = useRef(controller);
  const assistantResponseRef = useRef<string>("");
  const assistantReasoningRef = useRef<string>("");
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();

  const {
    addMessageToConversation,
    insertMessageBeforeConversationMessage,
    addAssistantMessage,
    updateAssistantMessage,
  } = useMessageOperations(requestOptions);

  const generateResponse = useCallback(
    async (
      messages: Message[],
      conversationId: string,
      overrideRequestOptions?: ChatRequestOptions,
      options?: Pick<StreamResponseOptions, "assistantMessageData" | "model" | "models">,
    ): Promise<{
      status: "success" | "error";
      response: string;
      message?: Message;
      messages?: Message[];
      toolResponses?: Message[];
      titled?: boolean;
    }> => {
      const requestSignal = controllerRef.current.signal;
      const effectiveRequestOptions = overrideRequestOptions ?? requestOptions;
      const storageMode = resolveConversationStorageMode(
        {
          chatMode,
          isAuthenticated,
          isPro,
          localOnlyMode,
          settingsLocalOnly: chatSettings.localOnly === true,
        },
        effectiveRequestOptions,
      );
      const isLocal = !storageMode.shouldSyncRemote && chatMode === "local";
      let response = "";
      let generatedMessage: Message | undefined;
      const generatedMessages: Message[] = [];
      const toolResponseMessages: Message[] = [];
      let messageWriteQueue: Promise<unknown> = Promise.resolve();
      const pendingMessageTasks: Promise<unknown>[] = [];
      let serverTitle = "";
      const knownMessageIds = new Set(
        messages.map((message) => message.id).filter((id): id is string => Boolean(id)),
      );
      const assistantMessageData = options?.assistantMessageData;
      let shouldRefreshStoredConversation = false;

      beginStreamActivity();

      const placeholderMessage = await addAssistantMessage(
        conversationId,
        "",
        undefined,
        assistantMessageData,
      );
      let activeAssistantMessage: Message | undefined = placeholderMessage;
      let activeAssistantMessagePromise: Promise<Message> | null =
        Promise.resolve(placeholderMessage);
      let assistantMessageCycle = 0;

      const enqueueMessageWrite = <T>(operation: () => Promise<T>): Promise<T> => {
        const queuedWrite = messageWriteQueue.then(operation);

        messageWriteQueue = queuedWrite.then(
          () => undefined,
          () => undefined,
        );

        return queuedWrite;
      };

      const ensureActiveAssistantMessage = (): Promise<Message> => {
        if (activeAssistantMessage) {
          return Promise.resolve(activeAssistantMessage);
        }

        if (activeAssistantMessagePromise) {
          return activeAssistantMessagePromise;
        }

        const cycle = assistantMessageCycle;

        activeAssistantMessagePromise = enqueueMessageWrite(() =>
          addAssistantMessage(conversationId, "", undefined, assistantMessageData),
        ).then((message) => {
          if (cycle === assistantMessageCycle) {
            activeAssistantMessage = message;
          }

          return message;
        });

        return activeAssistantMessagePromise;
      };

      const hasRenderableAssistantPayload = (candidate: Message): boolean => {
        if (typeof candidate.content === "string" && candidate.content.trim().length > 0) {
          return true;
        }

        if (Array.isArray(candidate.content) && candidate.content.length > 0) {
          return true;
        }

        return (
          (Array.isArray(candidate.parts) && candidate.parts.length > 0) ||
          Boolean(candidate.tool_calls?.length) ||
          Boolean(candidate.reasoning?.content)
        );
      };

      const withAssistantMessageData = (assistantMessage: Message): Message => ({
        ...assistantMessage,
        ...assistantMessageData,
        content: assistantMessage.content,
        model: assistantMessage.model ?? assistantMessageData?.model,
        reasoning: assistantMessage.reasoning ?? assistantMessageData?.reasoning,
        role: "assistant",
        status: assistantMessage.status,
      });

      const handleMessageUpdate = (
        content: Message["content"],
        reasoning?: string,
        toolResponses?: Message[],
        done?: boolean,
        assistantMessage?: Message,
      ) => {
        recordStreamActivityText({ content, reasoning });

        if (done && assistantMessage) {
          completeStreamActivityMessage(assistantMessage.id);

          const updatedAssistantMessage = withAssistantMessageData(assistantMessage);

          if (!hasRenderableAssistantPayload(updatedAssistantMessage)) {
            return;
          }

          generatedMessages.push(updatedAssistantMessage);
          generatedMessage = updatedAssistantMessage;
          const activeMessagePromise = ensureActiveAssistantMessage();

          assistantMessageCycle += 1;
          activeAssistantMessage = undefined;
          activeAssistantMessagePromise = null;
          pendingMessageTasks.push(
            activeMessagePromise.then((message) =>
              enqueueMessageWrite(() =>
                updateAssistantMessage(
                  conversationId,
                  updatedAssistantMessage.content,
                  updatedAssistantMessage.reasoning?.content || reasoning,
                  updatedAssistantMessage,
                  {
                    messageId: message.id,
                  },
                ),
              ),
            ),
          );
          response = "";

          return;
        }

        response = typeof content === "string" ? content : response;

        if (assistantMessage) {
          const updatedAssistantMessage = withAssistantMessageData({
            ...assistantMessage,
            content,
          });

          pendingMessageTasks.push(
            ensureActiveAssistantMessage().then((message) => {
              const metadataUpdate = {
                ...updatedAssistantMessage,
                id: message.id,
              };

              activeAssistantMessage = metadataUpdate;

              return enqueueMessageWrite(() =>
                updateAssistantMessage(
                  conversationId,
                  metadataUpdate.content,
                  metadataUpdate.reasoning?.content || reasoning,
                  metadataUpdate,
                  {
                    messageId: message.id,
                  },
                ),
              );
            }),
          );

          return;
        }

        if (toolResponses && toolResponses.length > 0) {
          for (const toolResponse of toolResponses) {
            recordStreamActivityToolResult({
              toolCallId: toolResponse.tool_call_id,
              name: toolResponse.name,
            });
            toolResponseMessages.push(toolResponse);
            generatedMessages.push(toolResponse);
            pendingMessageTasks.push(
              enqueueMessageWrite(() => addMessageToConversation(conversationId, toolResponse)),
            );
          }
        } else {
          pendingMessageTasks.push(
            ensureActiveAssistantMessage().then((message) =>
              enqueueMessageWrite(() =>
                updateAssistantMessage(
                  conversationId,
                  content,
                  reasoning,
                  activeAssistantMessage
                    ? { ...activeAssistantMessage, parts: undefined }
                    : undefined,
                  { messageId: message.id },
                ),
              ),
            ),
          );
        }
      };

      try {
        if (isLocal) {
          const currentModel = normalizeSelectedModel(options?.model ?? model);

          if (!currentModel) {
            throw new Error("Cannot generate local response without a selected model.");
          }

          const handleProgress = (text: string) => {
            response += text;
            assistantResponseRef.current = response;

            void updateAssistantMessage(conversationId, response, undefined, undefined, {
              messageId: placeholderMessage.id,
            });
          };

          const lastMessage = messages[messages.length - 1];
          const lastMessageContent = getMessageTextContent(lastMessage);

          response = await webLLMService.generate(
            String(conversationId),
            lastMessageContent,
            async (_chatId: string, content: any, _model: any, _mode: any, role: string) => {
              if (role !== "user") {
                handleMessageUpdate(content);
              }

              return [];
            },
            handleProgress,
          );
        } else {
          const shouldStore = storageMode.shouldSyncRemote;

          const normalizedMessages = messages.map(normalizeMessage);

          const modelsToSend = options?.models
            ?.map((modelId) => normalizeSelectedModel(modelId))
            .filter((modelId): modelId is string => Boolean(modelId));
          const selectedModel = normalizeSelectedModel(
            modelsToSend?.[0] ?? options?.model ?? model,
          );
          const modelToSend = modelsToSend?.length ? undefined : selectedModel;
          const providerToSend = getModelProvider(apiModels, selectedModel);
          const modelConfigToSend = selectedModel ? apiModels[selectedModel] : undefined;

          const handleStateChange = (state: string, data?: any) => {
            recordStreamActivityState(state, data);

            if (state === "conversation_title") {
              const title = typeof data?.title === "string" ? data.title.trim() : "";

              if (title) {
                serverTitle = title;
                updateConversationInChatCaches<Conversation>(
                  queryClient,
                  conversationId,
                  (conversation) => ({ ...conversation, title }),
                  CHATS_QUERY_KEY,
                  getLocalChatScope(user?.id),
                );
              }

              return;
            }

            if (state === "usage_limits") {
              const usageLimits = normaliseUsageLimits(data);

              if (usageLimits) {
                setUsageLimits(usageLimits);
              }

              return;
            }

            if (state === "compaction") {
              const compactionMessage = readCompactionStatusMessage(data?.message);

              if (compactionMessage) {
                const targetMessageId = activeAssistantMessage?.id || placeholderMessage.id;

                pendingMessageTasks.push(
                  enqueueMessageWrite(() =>
                    insertMessageBeforeConversationMessage(
                      conversationId,
                      compactionMessage,
                      targetMessageId,
                    ),
                  ),
                );
              }
            }

            const msg = getChatStreamLoadingMessage(state, data);

            if (!msg) {
              return;
            }

            updateLoading("stream-response", undefined, msg);
          };

          const assistantMessage = await apiService.streamChatCompletions({
            chatSettings,
            completionId: conversationId,
            endpoint: chatMode === "agent" ? `/agents/${selectedAgentId}/completions` : undefined,
            messages: normalizedMessages,
            mode: chatMode,
            model: modelToSend,
            modelConfig: modelConfigToSend,
            modelRouterMode: selectedModel ? undefined : autoMode,
            models: modelsToSend?.length ? modelsToSend : undefined,
            onProgress: handleMessageUpdate,
            onStateChange: handleStateChange,
            provider: providerToSend,
            requestOptions: effectiveRequestOptions,
            signal: requestSignal,
            store: shouldStore,
            streamingEnabled: true,
            useMultiModel: modelsToSend && modelsToSend.length > 1 ? true : useMultiModel,
          });

          if (shouldStore) {
            markConversationRemoteAvailable(conversationId);
            shouldRefreshStoredConversation = true;
          }

          const textPreview =
            typeof assistantMessage.content === "string"
              ? assistantMessage.content
              : getMessageTextContent(assistantMessage);

          if (generatedMessage?.id !== assistantMessage.id) {
            completeStreamActivityMessage(assistantMessage.id);

            const targetMessage = activeAssistantMessage || placeholderMessage;
            const updatedAssistantMessage = withAssistantMessageData(assistantMessage);

            await updateAssistantMessage(
              conversationId,
              updatedAssistantMessage.content,
              updatedAssistantMessage.reasoning?.content,
              updatedAssistantMessage,
              { messageId: targetMessage.id },
            );
          }

          response = textPreview;
          generatedMessage = withAssistantMessageData(assistantMessage);
          if (!generatedMessages.some((message) => message.id === generatedMessage?.id)) {
            generatedMessages.push(generatedMessage);
          }
        }

        await Promise.allSettled(pendingMessageTasks);
        await messageWriteQueue;
        if (shouldRefreshStoredConversation) {
          await queryClient.invalidateQueries({
            queryKey: [CHATS_QUERY_KEY, conversationId],
          });
        }

        await queryClient.invalidateQueries({ queryKey: [GOAL_QUERY_KEY, conversationId] });

        return {
          status: "success",
          response,
          message: generatedMessage,
          messages: generatedMessages,
          toolResponses: toolResponseMessages,
          titled: Boolean(serverTitle),
        };
      } catch (error) {
        if (requestSignal.aborted) {
          return { status: "error" as const, response: "Request aborted" };
        }

        if (isLocal || !storageMode.shouldSyncRemote || error instanceof ApiError) {
          throw error;
        }

        updateLoading("stream-response", undefined, "Reconnecting to the response...");

        const recoveredMessages = await recoverDetachedTurn({
          completionId: conversationId,
          knownMessageIds,
          fetchMessages: async (completionId) =>
            (await apiService.getChat(completionId)).messages ?? [],
          signal: requestSignal,
        });

        const recoveredAssistantMessage = recoveredMessages.find(
          (message) => message.role === "assistant",
        );

        if (!recoveredAssistantMessage) {
          throw error;
        }

        markConversationRemoteAvailable(conversationId);
        completeStreamActivityMessage(recoveredAssistantMessage.id);

        const updatedAssistantMessage = withAssistantMessageData(recoveredAssistantMessage);

        await messageWriteQueue;
        await updateAssistantMessage(
          conversationId,
          updatedAssistantMessage.content,
          updatedAssistantMessage.reasoning?.content,
          updatedAssistantMessage,
          { messageId: (activeAssistantMessage || placeholderMessage).id },
        );
        await queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, conversationId] });
        await queryClient.invalidateQueries({ queryKey: [GOAL_QUERY_KEY, conversationId] });

        return {
          status: "success",
          response: getMessageTextContent(updatedAssistantMessage),
          message: updatedAssistantMessage,
          messages: [updatedAssistantMessage],
          toolResponses: recoveredMessages.filter((message) => message.role === "tool"),
          titled: Boolean(serverTitle),
        };
      }
    },
    [
      chatMode,
      updateAssistantMessage,
      isAuthenticated,
      isPro,
      localOnlyMode,
      chatSettings,
      model,
      addMessageToConversation,
      insertMessageBeforeConversationMessage,
      addAssistantMessage,
      useMultiModel,
      autoMode,
      selectedAgentId,
      apiModels,
      updateLoading,
      webLLMService,
      requestOptions,
      markConversationRemoteAvailable,
      setUsageLimits,
      queryClient,
      beginStreamActivity,
      completeStreamActivityMessage,
      recordStreamActivityState,
      recordStreamActivityText,
      recordStreamActivityToolResult,
      user?.id,
    ],
  );

  const streamResponse = useCallback(
    async (
      messages: Message[],
      conversationId: string,
      overrideRequestOptions?: ChatRequestOptions,
      options?: StreamResponseOptions,
    ) => {
      if (!messages.length) {
        toast.error("No messages provided");
        throw new Error("No messages provided");
      }

      const requestController = new AbortController();
      let streamSettled = false;

      requestController.signal.addEventListener(
        "abort",
        () => {
          if (streamSettled) {
            return;
          }

          void apiService.cancelChatCompletion(conversationId).catch(() => {});
        },
        { once: true },
      );

      controllerRef.current = requestController;
      setController(requestController);

      try {
        const response = await generateResponse(messages, conversationId, overrideRequestOptions, {
          assistantMessageData: options?.assistantMessageData,
          model: options?.model,
          models: options?.models,
        });

        const shouldGenerateTitle = options?.generateTitle ?? true;

        if (
          shouldGenerateTitle &&
          response.status === "success" &&
          !response.titled &&
          messages.length <= 1 &&
          onTitleGeneration
        ) {
          onTitleGeneration(conversationId, messages).catch((err) =>
            console.error("Background title generation failed:", err),
          );
        }

        return response;
      } catch (error) {
        if (requestController.signal.aborted) {
          toast.error("Request aborted");
        } else {
          const streamError = error as Error & {
            status?: number;
            code?: string;
            message?: string;
          };

          console.error("Error generating response:", streamError);

          if (streamError.status === 429) {
            toast.error("Rate limit exceeded. Please try again later.");
          } else if (streamError.code === "model_not_found") {
            toast.error(`Model not found: ${model}`);
            setModel(null);
          } else {
            toast.error(streamError.message || "Failed to generate response");
          }

          throw streamError;
        }

        return {
          status: "error" as const,
          response: (error as Error).message || "Failed",
        };
      } finally {
        streamSettled = true;
        setStreamStarted(false);
        stopLoading("stream-response");
        endStreamActivity();
        if (controllerRef.current === requestController) {
          const nextController = new AbortController();

          controllerRef.current = nextController;
          setController(nextController);
        }
      }
    },
    [generateResponse, stopLoading, endStreamActivity, model, setModel, onTitleGeneration],
  );

  const abortStream = useCallback(() => {
    controllerRef.current.abort();
  }, []);

  return {
    streamStarted,
    setStreamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,
    streamResponse,
    generateResponse,
    abortStream,
  };
}
