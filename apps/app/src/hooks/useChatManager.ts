import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { normalizeSelectedModel } from "@ngriffin_uk/polychat-library-chat/model-selection";
import { upsertConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { EMPTY_MODEL_CONFIG } from "@ngriffin_uk/polychat-schemas";
import type { ConversationModeMetadata } from "@ngriffin_uk/polychat-schemas";
import { compactionStatusLabels } from "@ngriffin_uk/polychat-schemas/compaction-status";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { prepareUserMessage } from "~/lib/chat/prepare-user-message";
import { createTemporaryConversationTitle } from "~/lib/chat/title-source";
import { createConversationId } from "~/lib/conversations";
import { getErrorMessage } from "~/lib/errors";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, Conversation, Message } from "~/types";

import { useGenerateTitle } from "./useChat";
import { useConversationActions } from "./useConversationActions";
import { useConversationStorage } from "./useConversationStorage";
import { useMessageOperations } from "./useMessageOperations";
import { useModels } from "./useModels";
import { useStreamingResponse } from "./useStreamingResponse";
import { useWebLLMInitialization } from "./useWebLLMInitialization";

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

  const { currentConversationId, model, startNewConversation } = useChatStore();

  const { webLLMService } = useWebLLMInitialization(apiModels);
  const { determineStorageMode, updateConversation } = useConversationStorage(requestOptions);
  const { addMessageToConversation, addAssistantMessage, updateAssistantMessage } =
    useMessageOperations(requestOptions);

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

      if (conversation?.messages) {
        const lastAssistantMessage = conversation.messages
          .slice()
          .reverse()
          .find((msg) => msg.role === "assistant");

        if (lastAssistantMessage) {
          await generateConversationTitle(conversationId, messages, lastAssistantMessage);
        }
      }
    },
    [queryClient, generateConversationTitle],
  );

  const {
    streamStarted,
    setStreamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,
    streamResponse,
    abortStream,
  } = useStreamingResponse(webLLMService, handleTitleGeneration, requestOptions);

  const {
    editingMessageId,
    isBranching,
    retryMessage,
    updateUserMessage,
    startEditingMessage,
    stopEditingMessage,
    branchConversation,
    isRequestingSecondOpinion,
    requestSecondOpinion,
  } = useConversationActions(
    streamResponse,
    generateConversationTitle,
    setStreamStarted,
    requestOptions,
  );

  const sendMessage = useCallback(
    async (
      input: string,
      attachments?: AttachmentData[],
      overrideRequestOptions?: ChatRequestOptions,
    ) => {
      if (!input.trim() && !attachments?.length) {
        return {
          status: "error",
          response: "",
        };
      }

      setStreamStarted(true);
      startLoading("stream-response", "Generating response...");

      const currentModel = normalizeSelectedModel(model);

      try {
        let conversationId = currentConversationId;

        if (!conversationId) {
          conversationId = createConversationId();
          startNewConversation(conversationId);
        }

        const userMessage = prepareUserMessage(input, attachments, currentModel, conversationMode);

        await cancelConversationQueries(conversationId);

        const previousConversation = queryClient.getQueryData<Conversation>([
          CHATS_QUERY_KEY,
          conversationId,
        ]);

        await addMessageToConversation(conversationId, userMessage);

        const updatedMessages = previousConversation?.messages?.length
          ? [...previousConversation.messages, userMessage]
          : [userMessage];

        const response = await streamResponse(
          updatedMessages,
          conversationId,
          overrideRequestOptions,
        );

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
      currentConversationId,
      startNewConversation,
      queryClient,
      cancelConversationQueries,
      streamResponse,
      startLoading,
      addMessageToConversation,
      setStreamStarted,
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

    const isRemoteStoredConversation = determineStorageMode().shouldSyncRemote;

    if (!isRemoteStoredConversation) {
      return {
        status: "error" as const,
        response: "Compaction is only available for stored conversations.",
      };
    }

    setStreamStarted(true);
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
      setStreamStarted(false);
      stopLoading("stream-response");
    }
  }, [
    currentConversationId,
    determineStorageMode,
    queryClient,
    cancelConversationQueries,
    startLoading,
    stopLoading,
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

      setStreamStarted(true);
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
    [queryClient, setStreamStarted, startLoading, streamResponse],
  );

  return {
    streamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,
    editingMessageId,
    isBranching,
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
    branchConversation,
    isRequestingSecondOpinion,
    requestSecondOpinion,
  };
}
