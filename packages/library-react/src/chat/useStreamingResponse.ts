import {
  desktopExecutionBackend,
  getLocalChatScope,
  resolveComputeSiteForClient,
} from "@ngriffin_uk/polychat-library-chat";
import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import type {
  ChatRequestOptions,
  Conversation,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { readCompactionStatusMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import {
  getMessageTextContent,
  normalizeMessage,
} from "@ngriffin_uk/polychat-library-chat/messages";
import { normalizeSelectedModel } from "@ngriffin_uk/polychat-library-chat/model-selection";
import {
  CHATS_QUERY_KEY,
  apiService,
  useChatStore,
  useStreamActivityStore,
} from "@ngriffin_uk/polychat-library-client";
import {
  chatRunCommandReceiptSchema,
  chatTurnActivityEventSchema,
  createRunProvenance,
  EMPTY_MODEL_CONFIG,
  getModelProvider,
  isBrowserModel,
  isTerminalChatRunStatus,
  runsOnDevice,
  type ChatRun,
  type ChatRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { streamDeviceModelRun } from "../chat/device-run.js";
import { resolveAcceptedRunCommand } from "../chat/run-command.js";
import { createStreamProgressCoalescer } from "../chat/stream-progress-coalescer.js";
import { getChatStreamLoadingMessage } from "../chat/stream-state.js";
import { normaliseUsageLimits } from "../chat/usage-limits.js";
import { GOAL_QUERY_KEY } from "../chat/useGoal.js";
import { USAGE_QUERY_KEYS } from "../chat/useUsage.js";
import { updateConversationInChatCaches } from "../conversation-cache.js";
import { getErrorMessage } from "../errors.js";
import { useConversationScope } from "../state/conversation-scope.js";
import { useLoadingActions } from "../state/LoadingContext.js";
import { useUsageStore } from "../state/usageStore.js";
import { useMessageOperations } from "./useMessageOperations.js";
import { useModels } from "./useModels.js";
import { useWebLLMModels } from "./useWebLLMModels.js";

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
    computeSite,
    model,
    chatSettings,
    isAuthenticated,
    isPro,
    temporaryChat,
    temporaryChatsDefault,
    useMultiModel,
    modelTier,
    selectedTeammateId,
    markConversationRemoteAvailable,
    setModel,
    user,
  } = useChatStore();
  const setUsageLimits = useUsageStore((state) => state.setUsageLimits);
  const beginStreamActivity = useStreamActivityStore((state) => state.beginStreamActivity);
  const completeStreamActivityMessage = useStreamActivityStore(
    (state) => state.completeStreamActivityMessage,
  );
  const endStreamActivity = useStreamActivityStore((state) => state.endStreamActivity);
  const recordStreamActivityState = useStreamActivityStore(
    (state) => state.recordStreamActivityState,
  );
  const recordStreamActivityText = useStreamActivityStore(
    (state) => state.recordStreamActivityText,
  );
  const recordStreamActivityToolResult = useStreamActivityStore(
    (state) => state.recordStreamActivityToolResult,
  );
  const recordTurnActivity = useStreamActivityStore((state) => state.recordTurnActivity);
  const updateStreamLoadingMessage = useStreamActivityStore(
    (state) => state.updateStreamLoadingMessage,
  );
  const { currentConversationId } = useConversationScope();
  const currentStream = useStreamActivityStore((state) =>
    currentConversationId ? state.streams[currentConversationId] : undefined,
  );
  const assistantResponseRef = useRef<string>("");
  const assistantReasoningRef = useRef<string>("");
  const observedRunsRef = useRef<
    Record<string, { id: string; attempt: number; status: ChatRunStatus }>
  >({});
  const pendingCommandIdsRef = useRef<Record<string, string>>({});
  const computeSiteFallbackNoticeRef = useRef<Set<string>>(new Set());
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });

  const {
    addMessageToConversation,
    insertMessageBeforeConversationMessage,
    addAssistantMessage,
    updateAssistantMessage,
  } = useMessageOperations(requestOptions);

  const cancelObservedRun = useCallback(
    async (conversationId: string) => {
      const cachedRun = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ])?.latest_run;
      let observedRun: Pick<ChatRun, "id" | "attempt" | "status"> | null | undefined =
        observedRunsRef.current[conversationId] ?? cachedRun;
      const pendingCommandId = pendingCommandIdsRef.current[conversationId];

      if (!observedRun && pendingCommandId) {
        observedRun =
          (await resolveAcceptedRunCommand({
            fetchCommand: () => apiService.getChatRunCommand(pendingCommandId),
          })) ?? undefined;
      }

      if (!observedRun || isTerminalChatRunStatus(observedRun.status)) {
        return;
      }

      const receipt = await apiService.cancelChatRun(observedRun.id, observedRun.attempt);

      observedRunsRef.current[conversationId] = {
        id: receipt.run.id,
        attempt: receipt.run.attempt,
        status: receipt.run.status,
      };
      updateConversationInChatCaches<Conversation>(
        queryClient,
        conversationId,
        (conversation) => ({ ...conversation, latest_run: receipt.run }),
        CHATS_QUERY_KEY,
        getLocalChatScope(user?.id),
      );
    },
    [queryClient, user?.id],
  );

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
      errorPresentation?: "run";
    }> => {
      const requestSignal =
        useStreamActivityStore.getState().streams[conversationId]?.controller?.signal ??
        new AbortController().signal;
      const effectiveRequestOptions = overrideRequestOptions ?? requestOptions;
      const requestedModelId = normalizeSelectedModel(
        options?.models?.[0] ?? options?.model ?? model,
      );
      const availableModels =
        computeSite === "browser" ? { ...webLLMModels, ...apiModels } : apiModels;
      const requestedModel = requestedModelId ? availableModels[requestedModelId] : undefined;
      const deviceBackend = desktopExecutionBackend();
      const computeSiteResolution = resolveComputeSiteForClient({
        requestedSite: computeSite,
        requestedModel,
        requestedModelId,
        hasDesktopBackend: Boolean(deviceBackend),
        hasBrowserRuntime: Boolean(webLLMService),
      });
      const effectiveComputeSite = computeSiteResolution.computeSite;
      const effectiveModelId = computeSiteResolution.modelId;

      const fallbackNoticeKey = `${conversationId}:${computeSite}`;
      if (
        computeSiteResolution.reason &&
        !computeSiteFallbackNoticeRef.current.has(fallbackNoticeKey)
      ) {
        computeSiteFallbackNoticeRef.current.add(fallbackNoticeKey);
        toast.info(computeSiteResolution.reason);
      }

      const runsOnAnotherMachine = Boolean(
        effectiveComputeSite === "machine" && requestedModel?.machineId,
      );
      const runsOnThisDevice = Boolean(
        effectiveComputeSite === "device" &&
        requestedModel &&
        runsOnDevice(requestedModel) &&
        !requestedModel.machineId &&
        deviceBackend,
      );
      const runsInBrowser =
        !runsOnThisDevice && effectiveComputeSite === "browser" && isBrowserModel(requestedModel);
      const localRunProvenance =
        requestedModel && runsOnThisDevice
          ? createRunProvenance({
              site: "device",
              model: requestedModel.matchingModel,
              vendor: requestedModel.provider,
              ...(requestedModel.machineId ? { machineId: requestedModel.machineId } : {}),
            })
          : requestedModel && runsInBrowser
            ? createRunProvenance({
                site: "browser",
                model: requestedModel.matchingModel,
                vendor: requestedModel.provider,
              })
            : undefined;
      const storageMode = resolveConversationStorageMode(
        {
          isAuthenticated,
          isPro,
          temporaryChat:
            queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, conversationId])
              ?.isLocalOnly ?? temporaryChat,
          temporaryChatsDefault: queryClient.getQueryData<Conversation>([
            CHATS_QUERY_KEY,
            conversationId,
          ])
            ? false
            : temporaryChatsDefault,
          runsOnDevice: runsOnThisDevice || runsInBrowser,
        },
        effectiveRequestOptions,
      );
      let response = "";
      let generatedMessage: Message | undefined;
      const generatedMessages: Message[] = [];
      const toolResponseMessages: Message[] = [];
      let messageWriteQueue: Promise<unknown> = Promise.resolve();
      const pendingMessageTasks: Promise<unknown>[] = [];
      let serverTitle = "";
      const assistantMessageData = options?.assistantMessageData;
      const effectiveAssistantMessageData = localRunProvenance
        ? { ...assistantMessageData, provenance: localRunProvenance }
        : assistantMessageData;
      let shouldRefreshStoredConversation = false;
      const commandId = effectiveRequestOptions?.command_id ?? crypto.randomUUID();

      pendingCommandIdsRef.current[conversationId] = commandId;

      const placeholderMessage = await addAssistantMessage(conversationId, "", undefined, {
        ...effectiveAssistantMessageData,
        status: "in_progress",
      });
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
          addAssistantMessage(conversationId, "", undefined, effectiveAssistantMessageData),
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
        ...effectiveAssistantMessageData,
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
        recordStreamActivityText(conversationId, { content, reasoning });

        if (done && assistantMessage) {
          completeStreamActivityMessage(conversationId, assistantMessage.id);

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
            status: "in_progress",
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
            recordStreamActivityToolResult(conversationId, {
              toolCallId: toolResponse.tool_call_id,
              name: toolResponse.name,
              status: toolResponse.status,
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

      const streamProgress = createStreamProgressCoalescer(handleMessageUpdate);

      try {
        if (runsOnAnotherMachine) {
          throw new Error(
            "This model is advertised by another machine and remote machine execution is not available yet.",
          );
        }

        if (runsOnThisDevice && deviceBackend && requestedModel) {
          try {
            response = await streamDeviceModelRun({
              backend: deviceBackend,
              conversationId,
              messages,
              model: requestedModel,
              onContent: streamProgress.handleUpdate,
              signal: requestSignal,
            });
          } finally {
            streamProgress.stop();
          }

          assistantResponseRef.current = response;
          await updateAssistantMessage(conversationId, response, undefined, undefined, {
            messageId: placeholderMessage.id,
          });

          generatedMessage = { ...placeholderMessage, content: response, status: "completed" };
          generatedMessages.push(generatedMessage);
        } else if (runsInBrowser) {
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

          try {
            response = await webLLMService.generate(
              conversationId,
              lastMessageContent,
              async (_chatId: string, content: any, _model: any, _mode: any, role: string) => {
                if (role !== "user") {
                  streamProgress.handleUpdate(content);
                }

                return [];
              },
              handleProgress,
            );
          } finally {
            streamProgress.stop();
          }
        } else {
          const shouldStore = storageMode.retention === "kept";

          const normalizedMessages = messages.map(normalizeMessage);

          const modelsToSend = options?.models
            ?.map((modelId) => normalizeSelectedModel(modelId))
            .filter((modelId): modelId is string => Boolean(modelId));
          const selectedModel = effectiveModelId;
          const modelToSend = modelsToSend?.length ? undefined : selectedModel;
          const providerToSend = getModelProvider(apiModels, selectedModel);
          const modelConfigToSend = selectedModel ? apiModels[selectedModel] : undefined;

          const handleStateChange = (state: string, data?: any) => {
            if (state === "turn_activity") {
              const activity = chatTurnActivityEventSchema.safeParse(data);

              if (activity.success) {
                recordTurnActivity(conversationId, activity.data);
              }

              return;
            }

            recordStreamActivityState(conversationId, state, data);

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

            if (state === "run") {
              const receipt = chatRunCommandReceiptSchema.safeParse(data?.receipt);

              if (receipt.success) {
                observedRunsRef.current[conversationId] = {
                  id: receipt.data.run.id,
                  attempt: receipt.data.run.attempt,
                  status: receipt.data.run.status,
                };
                updateConversationInChatCaches<Conversation>(
                  queryClient,
                  conversationId,
                  (conversation) => ({ ...conversation, latest_run: receipt.data.run }),
                  CHATS_QUERY_KEY,
                  getLocalChatScope(user?.id),
                );
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

            updateStreamLoadingMessage(conversationId, msg);
            updateLoading("stream-response", undefined, msg);
          };

          let assistantMessage: Message;

          try {
            assistantMessage = await apiService.streamChatCompletions({
              chatSettings,
              completionId: conversationId,
              endpoint:
                chatMode === "agent" ? `/teammates/${selectedTeammateId}/completions` : undefined,
              messages: normalizedMessages,
              mode: chatMode,
              computeSite: effectiveComputeSite,
              model: modelToSend,
              modelConfig: modelConfigToSend,
              modelTier: selectedModel ? undefined : (modelTier ?? undefined),
              models: modelsToSend?.length ? modelsToSend : undefined,
              onProgress: streamProgress.handleUpdate,
              onStateChange: handleStateChange,
              provider: providerToSend,
              requestOptions: { ...effectiveRequestOptions, command_id: commandId },
              signal: requestSignal,
              store: shouldStore,
              streamingEnabled: true,
              useMultiModel: modelsToSend && modelsToSend.length > 1 ? true : useMultiModel,
            });
          } finally {
            streamProgress.stop();
          }

          if (shouldStore) {
            markConversationRemoteAvailable(conversationId);
            shouldRefreshStoredConversation = true;
          }

          const textPreview =
            typeof assistantMessage.content === "string"
              ? assistantMessage.content
              : getMessageTextContent(assistantMessage);

          if (generatedMessage?.id !== assistantMessage.id) {
            completeStreamActivityMessage(conversationId, assistantMessage.id);

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

        if (isAuthenticated && localRunProvenance) {
          await apiService
            .recordOffPlatformRunUsage({
              completion_id: conversationId,
              message_id: generatedMessage?.id ?? placeholderMessage.id,
              provenance: localRunProvenance,
            })
            .catch(() => undefined);
        }

        if ((runsOnThisDevice || runsInBrowser) && storageMode.retention === "kept") {
          const conversation = queryClient.getQueryData<Conversation>([
            CHATS_QUERY_KEY,
            conversationId,
          ]);

          if (conversation?.messages.length) {
            await apiService.updateConversation(conversationId, {
              title: conversation.title,
              messages: conversation.messages,
            });
            markConversationRemoteAvailable(conversationId);
            shouldRefreshStoredConversation = true;
          }
        }

        if (shouldRefreshStoredConversation) {
          await queryClient.invalidateQueries({
            queryKey: [CHATS_QUERY_KEY, conversationId],
          });
        }

        await queryClient.invalidateQueries({ queryKey: [GOAL_QUERY_KEY, conversationId] });
        if (isAuthenticated && storageMode.retention === "kept") {
          await queryClient.invalidateQueries({ queryKey: USAGE_QUERY_KEYS.balance });
        }

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

        if (storageMode.retention === "kept" && observedRunsRef.current[conversationId]) {
          markConversationRemoteAvailable(conversationId);
          updateConversationInChatCaches<Conversation>(
            queryClient,
            conversationId,
            (conversation) => ({
              ...conversation,
              messages: conversation.messages.filter(
                (message) => message.id !== placeholderMessage.id,
              ),
            }),
            CHATS_QUERY_KEY,
            getLocalChatScope(user?.id),
          );
          await queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY, conversationId] });

          return {
            status: "error" as const,
            response: getErrorMessage(error, "The task could not finish"),
            errorPresentation: "run" as const,
          };
        }

        throw error;
      } finally {
        if (pendingCommandIdsRef.current[conversationId] === commandId) {
          delete pendingCommandIdsRef.current[conversationId];
          delete observedRunsRef.current[conversationId];
        }
      }
    },
    [
      chatMode,
      computeSite,
      updateAssistantMessage,
      isAuthenticated,
      isPro,
      temporaryChat,
      temporaryChatsDefault,
      chatSettings,
      model,
      addMessageToConversation,
      insertMessageBeforeConversationMessage,
      addAssistantMessage,
      useMultiModel,
      modelTier,
      selectedTeammateId,
      apiModels,
      webLLMModels,
      updateLoading,
      webLLMService,
      requestOptions,
      markConversationRemoteAvailable,
      setUsageLimits,
      queryClient,
      completeStreamActivityMessage,
      recordStreamActivityState,
      recordStreamActivityText,
      recordStreamActivityToolResult,
      recordTurnActivity,
      updateStreamLoadingMessage,
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

          void cancelObservedRun(conversationId).catch(() => {});
        },
        { once: true },
      );

      beginStreamActivity(conversationId, requestController);

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
          return {
            status: "error" as const,
            response: (error as Error).message || "Request aborted",
          };
        }

        const streamError = error as Error & {
          status?: number;
          code?: string;
          message?: string;
        };

        console.error("Error generating response:", streamError);

        if (streamError.code === "model_not_found") {
          setModel(null);
        }

        throw streamError;
      } finally {
        streamSettled = true;
        stopLoading("stream-response");
        endStreamActivity(conversationId);
      }
    },
    [
      beginStreamActivity,
      cancelObservedRun,
      generateResponse,
      stopLoading,
      endStreamActivity,
      setModel,
      onTitleGeneration,
    ],
  );

  const abortStream = useCallback(() => {
    if (currentStream?.controller) {
      currentStream.controller.abort();
    } else if (currentStream?.source === "remote" && currentConversationId) {
      void cancelObservedRun(currentConversationId).catch(() => {
        toast.error("Could not stop the response. Please try again.");
      });
    }
  }, [cancelObservedRun, currentStream, currentConversationId]);

  return {
    streamStarted: currentStream?.status === "streaming",
    controller: currentStream?.controller,
    assistantResponseRef,
    assistantReasoningRef,
    streamResponse,
    generateResponse,
    abortStream,
  };
}
