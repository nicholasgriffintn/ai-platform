import {
  createBranchConversation,
  getBranchPoint,
} from "@ngriffin_uk/polychat-library-chat/branching";
import { normalizeMessage } from "@ngriffin_uk/polychat-library-chat/messages";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { createConversationId } from "~/lib/conversations";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, Conversation, Message } from "~/types";

import { useConversationStorage } from "./useConversationStorage";

/**
 * Hook for advanced conversation actions like editing, retrying, and branching.
 */
export function useConversationActions(
  generateResponse: (
    messages: Message[],
    conversationId: string,
    overrideRequestOptions?: ChatRequestOptions,
    options?: { generateTitle?: boolean; model?: string; models?: string[] },
  ) => Promise<{
    status: "success" | "error";
    response: string;
    message?: Message;
  }>,
  generateTitle: (
    conversationId: string,
    messages: Message[],
    assistantMessage: Message,
  ) => Promise<void>,
  setStreamStarted?: (started: boolean) => void,
  requestOptions?: ChatRequestOptions,
) {
  const queryClient = useQueryClient();
  const { currentConversationId, model, isAuthenticated, isPro, setCurrentConversationId } =
    useChatStore();

  const { determineStorageMode, updateConversation } = useConversationStorage(requestOptions);
  const { startLoading, stopLoading } = useLoadingActions();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isBranching, setIsBranching] = useState(false);
  const [isRequestingSecondOpinion, setIsRequestingSecondOpinion] = useState(false);
  const branchInFlightRef = useRef(false);
  const secondOpinionInFlightRef = useRef(false);

  const generateResponseWithLoading = useCallback(
    async (
      messages: Message[],
      conversationId: string,
      loadingMessage: string,
      overrideRequestOptions?: ChatRequestOptions,
      options?: { generateTitle?: boolean; model?: string; models?: string[] },
    ) => {
      setStreamStarted?.(true);
      startLoading("stream-response", loadingMessage);
      try {
        return await generateResponse(messages, conversationId, overrideRequestOptions, options);
      } finally {
        setStreamStarted?.(false);
        stopLoading("stream-response");
      }
    },
    [generateResponse, setStreamStarted, startLoading, stopLoading],
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        currentConversationId || "",
      ]);

      if (!conversation?.messages || !currentConversationId) {
        toast.error("Unable to retry: conversation not found");

        return;
      }

      const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId);

      if (messageIndex === -1) {
        toast.error("Unable to retry: message not found");

        return;
      }

      const message = conversation.messages[messageIndex];

      let messagesToRetry: Message[];

      if (message.role === "assistant") {
        messagesToRetry = conversation.messages.slice(0, messageIndex);
      } else {
        messagesToRetry = conversation.messages.slice(0, messageIndex + 1);
      }

      try {
        await updateConversation(currentConversationId, (prev) => ({
          ...prev!,
          messages: messagesToRetry,
        }));

        await generateResponseWithLoading(
          messagesToRetry,
          currentConversationId,
          "Generating response...",
        );
      } catch (error) {
        console.error("Error retrying message:", error);
        toast.error("Failed to retry message");
      }
    },
    [queryClient, currentConversationId, updateConversation, generateResponseWithLoading],
  );

  const updateUserMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        currentConversationId || "",
      ]);

      if (!conversation?.messages || !currentConversationId) {
        toast.error("Unable to edit: conversation not found");

        return;
      }

      const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId);

      if (messageIndex === -1) {
        toast.error("Unable to edit: message not found");

        return;
      }

      const message = conversation.messages[messageIndex];

      if (message.role !== "user") {
        toast.error("Can only edit user messages");

        return;
      }

      try {
        const updatedMessages = [...conversation.messages];

        updatedMessages[messageIndex] = {
          ...message,
          content: newContent.trim(),
        };

        const messagesToRegenerate = updatedMessages.slice(0, messageIndex + 1);

        await updateConversation(currentConversationId, (prev) => ({
          ...prev!,
          messages: messagesToRegenerate,
        }));

        await generateResponseWithLoading(
          messagesToRegenerate,
          currentConversationId,
          "Generating response...",
        );
      } catch (error) {
        console.error("Error updating message:", error);
        toast.error("Failed to update message");
      }
    },
    [queryClient, currentConversationId, updateConversation, generateResponseWithLoading],
  );

  const startEditingMessage = useCallback((messageId: string) => {
    setEditingMessageId(messageId);
  }, []);

  const stopEditingMessage = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const branchConversation = useCallback(
    async (messageId: string, selectedModelId?: string) => {
      if (branchInFlightRef.current) {
        return;
      }

      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        currentConversationId || "",
      ]);

      if (!conversation?.messages || !currentConversationId) {
        toast.error("Unable to branch: conversation not found");

        return;
      }

      const branchPoint = getBranchPoint(conversation.messages, messageId);

      if (!branchPoint) {
        toast.error("Unable to branch: message not found");

        return;
      }

      try {
        branchInFlightRef.current = true;
        setIsBranching(true);

        const newConversationId = createConversationId();
        const shouldStore = determineStorageMode(currentConversationId).shouldSyncRemote;
        let branchConversation = createBranchConversation({
          conversation,
          conversationId: newConversationId,
          isLocalOnly: !shouldStore,
          messages: branchPoint.messages,
          parentConversationId: currentConversationId,
          parentMessageId: messageId,
        });

        if (shouldStore) {
          const storedBranchConversation = await apiService.updateConversation(newConversationId, {
            title: branchConversation.title,
            messages: branchPoint.messages,
            parent_conversation_id: currentConversationId,
            parent_message_id: messageId,
          });

          branchConversation = {
            ...branchConversation,
            ...storedBranchConversation,
            id: storedBranchConversation.id || newConversationId,
            messages: storedBranchConversation.messages.length
              ? storedBranchConversation.messages
              : branchPoint.messages,
            parent_conversation_id: currentConversationId,
            parent_message_id: messageId,
            isLocalOnly: false,
          };
        }

        await updateConversation(newConversationId, () => branchConversation);
        setCurrentConversationId(newConversationId);

        if (branchPoint.shouldGenerateResponse) {
          const result = await generateResponseWithLoading(
            branchConversation.messages,
            newConversationId,
            "Generating branched response...",
            undefined,
            {
              generateTitle: false,
              model: selectedModelId || model || undefined,
            },
          );

          if (result.status === "success" && result.message) {
            generateTitle(newConversationId, branchConversation.messages, result.message).catch(
              (err) =>
                console.error("Background title generation failed for branched conversation:", err),
            );
          }
        }

        toast.success("Conversation branched successfully!");
      } catch (error) {
        console.error("Error branching conversation:", error);
        toast.error("Failed to branch conversation");
      } finally {
        branchInFlightRef.current = false;
        setIsBranching(false);
      }
    },
    [
      queryClient,
      currentConversationId,
      determineStorageMode,
      model,
      updateConversation,
      setCurrentConversationId,
      generateResponseWithLoading,
      generateTitle,
    ],
  );

  const requestSecondOpinion = useCallback(
    async (messageId: string) => {
      if (secondOpinionInFlightRef.current) {
        return;
      }

      if (!isAuthenticated || !isPro) {
        toast.error("Second opinions are only available to Pro users");

        return;
      }

      const conversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        currentConversationId || "",
      ]);

      if (!conversation?.messages || !currentConversationId) {
        toast.error("Unable to request a second opinion: conversation not found");

        return;
      }

      const source = conversation.messages.find((message) => message.id === messageId);

      if (!source) {
        toast.error("Unable to request a second opinion: message not found");

        return;
      }

      try {
        secondOpinionInFlightRef.current = true;
        setIsRequestingSecondOpinion(true);

        const messages = [
          ...conversation.messages,
          normalizeMessage({
            role: "user",
            content: "Get a second opinion on that answer from other models.",
            id: crypto.randomUUID(),
            created: Date.now(),
            model: model || "",
          }),
        ];

        await updateConversation(currentConversationId, (prev) => ({
          ...prev!,
          messages,
        }));

        await generateResponseWithLoading(
          messages,
          currentConversationId,
          "Asking for a second opinion...",
          undefined,
          { generateTitle: false },
        );
      } catch (error) {
        console.error("Error requesting a second opinion:", error);
        toast.error("Failed to request a second opinion");
      } finally {
        secondOpinionInFlightRef.current = false;
        setIsRequestingSecondOpinion(false);
      }
    },
    [
      queryClient,
      currentConversationId,
      model,
      isAuthenticated,
      isPro,
      updateConversation,
      generateResponseWithLoading,
    ],
  );

  return {
    editingMessageId,
    isBranching,
    isRequestingSecondOpinion,
    retryMessage,
    updateUserMessage,
    startEditingMessage,
    stopEditingMessage,
    branchConversation,
    requestSecondOpinion,
  };
}
