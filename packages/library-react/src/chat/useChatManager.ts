import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type {
  ChatRequestOptions,
  Conversation,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { createGoalMarkerMessage } from "@ngriffin_uk/polychat-library-chat/message-goal-status";
import { normalizeSelectedModel } from "@ngriffin_uk/polychat-library-chat/model-selection";
import {
  CHATS_QUERY_KEY,
  apiService,
  useChatStore,
  useStreamActivityStore,
} from "@ngriffin_uk/polychat-library-client";
import { EMPTY_MODEL_CONFIG } from "@ngriffin_uk/polychat-schemas";
import type { ConversationModeMetadata } from "@ngriffin_uk/polychat-schemas";
import { compactionStatusLabels } from "@ngriffin_uk/polychat-schemas/compaction-status";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { prepareUserMessage } from "../chat/prepare-user-message.js";
import {
  createTemporaryConversationTitle,
  isPlaceholderConversationTitle,
} from "../chat/title-source.js";
import { upsertConversationInChatCaches } from "../conversation-cache.js";
import { getErrorMessage } from "../errors.js";
import { useConversationScope } from "../state/conversation-scope.js";
import { useLoadingActions } from "../state/LoadingContext.js";
import { useGenerateTitle } from "./useChat.js";
import { useConversationActions } from "./useConversationActions.js";
import { useConversationStorage } from "./useConversationStorage.js";
import { useMessageOperations } from "./useMessageOperations.js";
import { useModels } from "./useModels.js";
import { useStreamingResponse } from "./useStreamingResponse.js";
import { useWebLLMInitialization } from "./useWebLLMInitialization.js";

/**
 * Main hook for managing chat operations.
 * Composes smaller hooks to handle streaming, storage, WebLLM, and conversation actions.
 */
export function useChatManager(
  requestOptions?: ChatRequestOptions,
  conversationMode?: ConversationModeMetadata,
) {
  const queryClient = useQueryClient();
  const generateTitleMutation = useGenerateTitle(requestOptions);
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const { startLoading, stopLoading } = useLoadingActions();
  const beginStreamActivity = useStreamActivityStore((state) => state.beginStreamActivity);
  const endStreamActivity = useStreamActivityStore((state) => state.endStreamActivity);

  const model = useChatStore((state) => state.model);
  const { currentConversationId, startNewConversation, getCurrentConversationId } =
    useConversationScope();

  const { webLLMService } = useWebLLMInitialization(apiModels);
  const { determineStorageMode, updateConversation } = useConversationStorage(requestOptions);
  const {
    addMessageToConversation,
    insertMessageBeforeConversationMessage,
    addAssistantMessage,
    updateAssistantMessage,
  } = useMessageOperations(requestOptions);

  const cancelConversationQueries = useCallback(
    async (conversationId: string) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: [CHATS_QUERY_KEY, conversationId],
          exact: true,
        }),
        queryClient.cancelQueries({
          queryKey: [CHATS_QUERY_KEY, "local"],
        }),
        queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY, "remote"] }),
      ]);
    },
    [queryClient],
  );

  const generateConversationTitle = useCallback(
    async (conversationId: string, messages: Message[], assistantMessage: Message) => {
      try {
        const tempTitle = createTemporaryConversationTitle(messages);

        await updateConversation(conversationId, (oldData) => ({
          ...oldData!,
          title: tempTitle,
        }));

        const finalTitle = await generateTitleMutation.mutateAsync({
          completion_id: conversationId,
          messages: [...messages, assistantMessage],
        });

        await updateConversation(conversationId, (oldData) => ({
          ...oldData!,
          title: finalTitle,
        }));
      } catch (error) {
        console.error("Failed to generate title:", error);
      }
    },
    [generateTitleMutation, updateConversation],
  );

  const handleTitleGeneration = useCallback(
    async (conversationId: string, messages: Message[]) => {
      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);

      if (
        !conversation?.messages ||
        !isPlaceholderConversationTitle(conversation.title, messages)
      ) {
        return;
      }

      const lastAssistantMessage = conversation.messages
        .slice()
        .reverse()
        .find((msg) => msg.role === "assistant");

      if (lastAssistantMessage) {
        await generateConversationTitle(conversationId, messages, lastAssistantMessage);
      }
    },
    [queryClient, generateConversationTitle],
  );

  const {
    streamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,
    streamResponse,
    abortStream,
  } = useStreamingResponse(webLLMService, handleTitleGeneration, requestOptions);

  const {
    editingMessageId,
    isStartingThread,
    retryMessage,
    updateUserMessage,
    startEditingMessage,
    stopEditingMessage,
    startConversationThread,
    isRequestingSecondOpinion,
    requestSecondOpinion,
  } = useConversationActions(streamResponse, generateConversationTitle, requestOptions);

  const sendMessage = useCallback(
    async (
      input: string,
      attachments?: AttachmentData[],
      overrideRequestOptions?: ChatRequestOptions,
      timelineOptions?: { goalStarted?: string },
    ) => {
      if (!input.trim() && !attachments?.length) {
        return {
          status: "error",
          response: "",
        };
      }

      startLoading("stream-response", "Generating response...");

      const currentModel = normalizeSelectedModel(model);

      try {
        let conversationId = getCurrentConversationId();

        if (!conversationId) {
          conversationId = generateId();
          startNewConversation(conversationId);
        }

        const userMessage = prepareUserMessage(input, attachments, currentModel, conversationMode);

        await cancelConversationQueries(conversationId);
        await addMessageToConversation(conversationId, userMessage);

        if (timelineOptions?.goalStarted) {
          await insertMessageBeforeConversationMessage(
            conversationId,
            createGoalMarkerMessage({
              event: "set",
              objective: timelineOptions.goalStarted,
            }),
            userMessage.id,
          );
        }

        const updatedConversation = queryClient.getQueryData<Conversation>([
          CHATS_QUERY_KEY,
          conversationId,
        ]);
        const updatedMessages = updatedConversation?.messages ?? [userMessage];

        const response = await streamResponse(
          updatedMessages,
          conversationId,
          overrideRequestOptions,
        );

        const toolInteraction = overrideRequestOptions?.options?.toolInteraction;

        if (response.status === "success" && toolInteraction) {
          await addMessageToConversation(conversationId, {
            ...userMessage,
            data: { ...userMessage.data, toolInteraction },
          });
        }

        return response;
      } catch (error) {
        console.error("Failed to send message:", error);

        return {
          status: "error",
          response: (error as Error).message || "Failed",
        };
      }
    },
    [
      model,
      startNewConversation,
      getCurrentConversationId,
      queryClient,
      cancelConversationQueries,
      streamResponse,
      startLoading,
      addMessageToConversation,
      insertMessageBeforeConversationMessage,
      conversationMode,
    ],
  );

  const compactConversation = useCallback(async () => {
    if (!currentConversationId) {
      return {
        status: "error" as const,
        response: "No conversation to compact",
      };
    }

    const isRemoteStoredConversation =
      determineStorageMode(currentConversationId).retention === "kept";

    if (!isRemoteStoredConversation) {
      return {
        status: "error" as const,
        response: "Compaction is only available for stored conversations.",
      };
    }

    beginStreamActivity(currentConversationId, undefined, compactionStatusLabels.manualPending);
    startLoading("stream-response", compactionStatusLabels.manualPending);

    try {
      await cancelConversationQueries(currentConversationId);
      const result = await apiService.compactConversation(currentConversationId);

      upsertConversationInChatCaches(queryClient, result.conversation, {
        includeLocalList: false,
        includeRemoteLists: true,
      });

      return {
        status: "success" as const,
        response: "",
        compacted: result.compacted,
      };
    } catch (error) {
      console.error("Failed to compact conversation:", error);

      return {
        status: "error" as const,
        response: getErrorMessage(error, "Failed to compact conversation"),
      };
    } finally {
      stopLoading("stream-response");
      endStreamActivity(currentConversationId);
    }
  }, [
    currentConversationId,
    determineStorageMode,
    queryClient,
    cancelConversationQueries,
    startLoading,
    stopLoading,
    beginStreamActivity,
    endStreamActivity,
  ]);

  const respondToExistingConversation = useCallback(
    async (
      conversationId: string,
      options?: {
        assistantMessageData?: Partial<Message>;
        model?: string;
        requestOptions?: ChatRequestOptions;
      },
    ) => {
      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);

      if (!conversation?.messages.length) {
        return {
          status: "error",
          response: "No messages provided",
        };
      }

      startLoading("stream-response", "Generating response...");

      try {
        return await streamResponse(
          conversation.messages,
          conversationId,
          options?.requestOptions,
          {
            assistantMessageData: options?.assistantMessageData,
            model: options?.model,
          },
        );
      } catch (error) {
        console.error("Failed to respond to live transcript:", error);

        return {
          status: "error",
          response: getErrorMessage(error, "Failed"),
        };
      }
    },
    [queryClient, startLoading, streamResponse],
  );

  return {
    streamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,
    editingMessageId,
    isStartingThread,
    compactConversation,
    sendMessage,
    respondToExistingConversation,
    streamResponse,
    abortStream,
    addAssistantMessage,
    updateAssistantMessage,
    retryMessage,
    updateUserMessage,
    startEditingMessage,
    stopEditingMessage,
    startConversationThread,
    isRequestingSecondOpinion,
    requestSecondOpinion,
  };
}
