import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { localChatService } from "~/lib/local/local-chat-service";
import { normalizeMessage } from "~/lib/messages";
import { webLLMModels } from "~/lib/models";
import { WebLLMService } from "~/lib/web-llm";
import { useError } from "~/state/contexts/ErrorContext";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { useGenerateTitle } from "./useChat";
import { useModels } from "./useModels";

export function useChatManager() {
  const queryClient = useQueryClient();
  const generateTitle = useGenerateTitle();
  const { data: apiModels = {} } = useModels();
  const { addError } = useError();
  const { startLoading, updateLoading, stopLoading } = useLoadingActions();

  const {
    currentConversationId,
    startNewConversation,
    chatMode,
    model,
    chatSettings,
    isAuthenticated,
    isPro,
    localOnlyMode,
    setModel,
    useMultiModel,
  } = useChatStore();

  const [streamStarted, setStreamStarted] = useState(false);
  const [controller, setController] = useState(() => new AbortController());

  const webLLMService = useRef<WebLLMService>(WebLLMService.getInstance());
  const assistantResponseRef = useRef<string>("");
  const assistantReasoningRef = useRef<string>("");
  const initializingRef = useRef<boolean>(false);

  const matchingModel =
    model === null
      ? undefined
      : chatMode === "local"
        ? webLLMModels[model]
        : apiModels[model];

  useEffect(() => {
    const loadingId = "model-init";
    let mounted = true;

    const initializeLocalModel = async () => {
      if (!mounted || initializingRef.current) return;

      if (
        model &&
        chatMode === "local" &&
        matchingModel?.provider === "web-llm"
      ) {
        try {
          initializingRef.current = true;

          startLoading(
            loadingId,
            `Initializing ${matchingModel.name || model}...`,
          );

          updateLoading(
            loadingId,
            0,
            `Preparing to load ${matchingModel.name || model}...`,
          );

          await webLLMService.current.init(model, (progress) => {
            if (!mounted) return;

            const progressPercent = Math.round(progress.progress * 100);

            updateLoading(
              loadingId,
              Math.max(1, progressPercent),
              progress.text || `Loading ${matchingModel.name || model}...`,
            );
          });
        } catch (error) {
          console.error("[useChatManager] Failed to initialize WebLLM:", error);
          if (mounted) {
            addError("Failed to initialize local model. Please try again.");
            setModel(null);
          }
        } finally {
          if (mounted) {
            stopLoading(loadingId);
            initializingRef.current = false;
          }
        }
      } else if (initializingRef.current) {
        stopLoading(loadingId);
        initializingRef.current = false;
      }
    };

    const timer = setTimeout(() => {
      initializeLocalModel();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (initializingRef.current) {
        stopLoading(loadingId);
        initializingRef.current = false;
      }
    };
  }, [
    chatMode,
    model,
    matchingModel,
    startLoading,
    updateLoading,
    stopLoading,
    addError,
    setModel,
  ]);

  const determineStorageMode = useCallback(() => {
    const isLocalOnly =
      !isAuthenticated ||
      !isPro ||
      localOnlyMode ||
      chatSettings.localOnly === true ||
      chatMode === "local";

    return {
      isLocalOnly,
      shouldSyncRemote: !isLocalOnly,
    };
  }, [isAuthenticated, isPro, localOnlyMode, chatSettings.localOnly, chatMode]);

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (conversation: Conversation | undefined) => Conversation,
    ) => {
      const { isLocalOnly } = determineStorageMode();

      const currentConversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);
      const allConversations =
        queryClient.getQueryData<Conversation[]>([CHATS_QUERY_KEY]) || [];

      const now = new Date().toISOString();
      const updatedConversation = {
        ...updater(currentConversation),
        isLocalOnly: updater(currentConversation)?.isLocalOnly || isLocalOnly,
        created_at: updater(currentConversation)?.created_at || now,
        updated_at: now,
        last_message_at: now,
      };

      queryClient.setQueryData(
        [CHATS_QUERY_KEY, conversationId],
        updatedConversation,
      );

      const existingIndex = allConversations.findIndex(
        (c) => c.id === conversationId,
      );
      const updatedAllConversations = [...allConversations];

      if (existingIndex >= 0) {
        updatedAllConversations[existingIndex] = updatedConversation;
      } else {
        updatedAllConversations.unshift(updatedConversation);
      }

      queryClient.setQueryData([CHATS_QUERY_KEY], updatedAllConversations);

      if (isLocalOnly) {
        const localChats =
          queryClient.getQueryData<Conversation[]>([
            CHATS_QUERY_KEY,
            "local",
          ]) || [];

        const localExistingIndex = localChats.findIndex(
          (c) => c.id === conversationId,
        );
        const updatedLocalChats = [...localChats];

        if (localExistingIndex >= 0) {
          updatedLocalChats[localExistingIndex] = updatedConversation;
        } else {
          updatedLocalChats.unshift(updatedConversation);
        }

        queryClient.setQueryData([CHATS_QUERY_KEY, "local"], updatedLocalChats);
      } else {
        const remoteChats =
          queryClient.getQueryData<Conversation[]>([
            CHATS_QUERY_KEY,
            "remote",
          ]) || [];
        const remoteExistingIndex = remoteChats.findIndex(
          (c) => c.id === conversationId,
        );
        const updatedRemoteChats = [...remoteChats];

        if (remoteExistingIndex >= 0) {
          updatedRemoteChats[remoteExistingIndex] = updatedConversation;
        } else {
          updatedRemoteChats.unshift(updatedConversation);
        }

        queryClient.setQueryData(
          [CHATS_QUERY_KEY, "remote"],
          updatedRemoteChats,
        );
      }

      if (isLocalOnly) {
        await localChatService.saveLocalChat({
          ...updatedConversation,
          isLocalOnly: true,
        });
      }
    },
    [queryClient, determineStorageMode],
  );

  const addMessageToConversation = useCallback(
    async (conversationId: string, message: Message) => {
      const normalizedMessage = normalizeMessage(message);

      await updateConversation(conversationId, (oldData) => {
        if (!oldData) {
          const messageContent =
            typeof normalizedMessage.content === "string"
              ? normalizedMessage.content
              : normalizedMessage.content
                  .map((item) => (item.type === "text" ? item.text : ""))
                  .join(" ");

          const now = new Date().toISOString();
          return {
            id: conversationId,
            title: `${messageContent.slice(0, 20)}...`,
            messages: [normalizedMessage],
            isLocalOnly: false,
            created_at: now,
            updated_at: now,
            last_message_at: now,
          };
        }

        return {
          ...oldData,
          messages: [...oldData.messages, normalizedMessage],
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        };
      });
    },
    [updateConversation],
  );

  const updateAssistantMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      reasoning?: string,
      messageData?: Partial<Message>,
    ) => {
      assistantResponseRef.current = content;
      if (reasoning) {
        assistantReasoningRef.current = reasoning;
      }

      await updateConversation(conversationId, (oldData) => {
        const now = Date.now();
        const nowISOString = new Date(now).toISOString();
        const currentModel = model === null ? undefined : model;

        if (!oldData) {
          const assistantMessage = normalizeMessage({
            role: "assistant",
            content,
            id: messageData?.id || crypto.randomUUID(),
            created: messageData?.created || now,
            timestamp: messageData?.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : undefined,
            ...messageData,
          });

          return {
            id: conversationId,
            title: `${content.slice(0, 20)}...`,
            messages: [assistantMessage],
            isLocalOnly: false,
            created_at: nowISOString,
            updated_at: nowISOString,
            last_message_at: nowISOString,
          };
        }

        const messages = [...oldData.messages];
        const lastMessageIndex = messages.length - 1;
        const hasAssistantLastMessage =
          lastMessageIndex >= 0 &&
          messages[lastMessageIndex].role === "assistant";

        let updatedMessages;

        if (!hasAssistantLastMessage) {
          const newAssistantMessage = normalizeMessage({
            role: "assistant",
            content,
            id: messageData?.id || crypto.randomUUID(),
            created: messageData?.created || now,
            timestamp: messageData?.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : undefined,
            ...messageData,
          });

          updatedMessages = [...messages, newAssistantMessage];
        } else {
          const lastMessage = messages[lastMessageIndex];

          const updatedMessage = normalizeMessage({
            ...lastMessage,
            ...(messageData || {}),
            role: "assistant",
            content,
            created: messageData?.created || lastMessage.created || now,
            timestamp: messageData?.timestamp || lastMessage.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : lastMessage.reasoning,
          });

          messages[lastMessageIndex] = updatedMessage;
          updatedMessages = [...messages];
        }

        return {
          ...oldData,
          messages: updatedMessages,
          updated_at: nowISOString,
          last_message_at: nowISOString,
          created_at: oldData.created_at || nowISOString,
        };
      });
    },
    [model, updateConversation],
  );

  const generateConversationTitle = useCallback(
    async (
      conversationId: string,
      messages: Message[],
      assistantMessage: Message,
    ) => {
      try {
        const userMessage = messages[0] || { content: "" };
        const titleText =
          typeof userMessage.content === "string"
            ? userMessage.content
            : userMessage.content
                .map((item) => (item.type === "text" ? item.text : ""))
                .join(" ");
        const tempTitle = `${titleText.slice(0, 30)}${titleText.length > 30 ? "..." : ""}`;

        await updateConversation(conversationId, (oldData) => ({
          ...oldData!,
          title: tempTitle,
        }));

        const finalTitle = await generateTitle.mutateAsync({
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
    [generateTitle, updateConversation],
  );

  const generateResponse = useCallback(
    async (
      messages: Message[],
      conversationId: string,
    ): Promise<{
      status: "success" | "error";
      response: string;
    }> => {
      const isLocal = chatMode === "local";
      let response = "";

      await updateAssistantMessage(conversationId, "");

      const handleMessageUpdate = (
        content: string,
        reasoning?: string,
        toolResponses?: Message[],
      ) => {
        response = content;

        if (toolResponses && toolResponses.length > 0) {
          setTimeout(() => {
            for (const toolResponse of toolResponses) {
              addMessageToConversation(conversationId, toolResponse);
            }
          }, 0);
        } else {
          updateAssistantMessage(conversationId, content, reasoning);
        }
      };

      try {
        if (isLocal) {
          if (!model) {
            throw new Error(
              "Cannot generate local response without a selected model.",
            );
          }
          const handleProgress = (text: string) => {
            response += text;
            assistantResponseRef.current = response;

            updateAssistantMessage(conversationId, response);
          };

          const lastMessage = messages[messages.length - 1];
          const lastMessageContent =
            typeof lastMessage.content === "string"
              ? lastMessage.content
              : lastMessage.content.map((item) => item.text || "").join("");

          response = await webLLMService.current.generate(
            String(conversationId),
            lastMessageContent,
            async (_chatId, content, _model, _mode, role) => {
              if (role !== "user") handleMessageUpdate(content);
              return [];
            },
            handleProgress,
          );
        } else {
          const shouldStore =
            isAuthenticated &&
            isPro &&
            !localOnlyMode &&
            !chatSettings.localOnly;

          const normalizedMessages = messages.map(normalizeMessage);

          const modelToSend = model === null ? undefined : model;

          const assistantMessage = await apiService.streamChatCompletions(
            conversationId,
            normalizedMessages,
            modelToSend,
            chatMode,
            chatSettings,
            controller.signal,
            handleMessageUpdate,
            shouldStore,
            true,
            useMultiModel,
          );

          const messageContent =
            typeof assistantMessage.content === "string"
              ? assistantMessage.content
              : assistantMessage.content
                  .map((item) => item.text || "")
                  .join("");

          response = messageContent || "";

          await updateAssistantMessage(
            conversationId,
            messageContent,
            assistantMessage.reasoning?.content,
            {
              id: assistantMessage.id,
              created: assistantMessage.created,
              model: assistantMessage.model || modelToSend,
              citations: assistantMessage.citations,
              usage: assistantMessage.usage,
              log_id: assistantMessage.log_id,
              data: assistantMessage.data,
              status: assistantMessage.status,
              timestamp: assistantMessage.timestamp,
              tool_calls: assistantMessage.tool_calls,
            },
          );
        }

        if (messages.length <= 1) {
          setTimeout(() => {
            const assistantMessage = normalizeMessage({
              id: crypto.randomUUID(),
              created: Date.now(),
              model: model === null ? undefined : model,
              role: "assistant",
              content: response,
              reasoning: assistantReasoningRef.current
                ? { collapsed: true, content: assistantReasoningRef.current }
                : undefined,
            });

            generateConversationTitle(
              conversationId,
              messages,
              assistantMessage,
            ).catch((err) =>
              console.error("Background title generation failed:", err),
            );
          }, 0);
        }

        return {
          status: "success",
          response,
        };
      } catch (error) {
        if (controller.signal.aborted) {
          console.log("Request aborted by user.");
          return { status: "error", response: "Request aborted" };
        }
        throw error;
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
      controller,
      generateConversationTitle,
      addMessageToConversation,
      useMultiModel,
    ],
  );

  const streamResponse = useCallback(
    async (messages: Message[], conversationId: string) => {
      if (!messages.length) {
        addError("No messages provided");
        throw new Error("No messages provided");
      }

      try {
        const response = await generateResponse(messages, conversationId);
        return response;
      } catch (error) {
        if (controller.signal.aborted) {
          addError("Request aborted", "info");
        } else {
          const streamError = error as Error & {
            status?: number;
            code?: string;
            message?: string;
          };
          console.error("Error generating response:", streamError);

          if (streamError.status === 429) {
            addError("Rate limit exceeded. Please try again later.");
          } else if (streamError.code === "model_not_found") {
            addError(`Model not found: ${model}`);
            setModel(null);
          } else {
            addError(streamError.message || "Failed to generate response");
          }

          throw streamError;
        }
        return {
          status: "error",
          response: (error as Error).message || "Failed",
        };
      } finally {
        setStreamStarted(false);
        stopLoading("stream-response");
        setController(new AbortController());
      }
    },
    [addError, generateResponse, controller, stopLoading, model, setModel],
  );

  const sendMessage = useCallback(
    async (
      input: string,
      attachmentData?: {
        type: string;
        data: string;
        name?: string;
        markdown?: string;
      },
    ) => {
      if (!input.trim() && !attachmentData) {
        return {
          status: "error",
          response: "",
        };
      }

      setStreamStarted(true);
      startLoading("stream-response", "Generating response...");

      const userMessageId = crypto.randomUUID();
      const currentTime = Date.now();
      const currentModel = model === null ? undefined : model;

      const contentItems: any[] = [
        {
          type: "text",
          text: input.trim(),
        },
      ];

      const prepareUserMessage = () => {
        if (attachmentData) {
          if (attachmentData.type === "image") {
            contentItems.push({
              type: "image_url",
              image_url: {
                url: attachmentData.data,
                detail: "auto",
              },
            });
          } else if (attachmentData.type === "document") {
            contentItems.push({
              type: "document_url",
              document_url: {
                url: attachmentData.data,
                name: attachmentData.name,
              },
            });
          }

          if (
            attachmentData?.type === "markdown_document" &&
            attachmentData?.markdown
          ) {
            contentItems.push({
              type: "markdown_document",
              markdown_document: {
                markdown: attachmentData.markdown,
                name: attachmentData.name,
              },
            });
          }

          return normalizeMessage({
            role: "user",
            content: contentItems,
            id: userMessageId,
            created: currentTime,
            model: currentModel,
          });
        }

        return normalizeMessage({
          role: "user",
          content: input.trim(),
          id: userMessageId,
          created: currentTime,
          model: currentModel,
        });
      };

      try {
        let conversationId = currentConversationId;
        if (!conversationId) {
          conversationId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          startNewConversation(conversationId);
        }

        const userMessage = prepareUserMessage();

        const cancelQueries = async () => {
          await Promise.all([
            queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY] }),
            queryClient.cancelQueries({
              queryKey: [CHATS_QUERY_KEY, conversationId],
              exact: true,
            }),
          ]);
        };

        const previousConversation = queryClient.getQueryData<Conversation>([
          CHATS_QUERY_KEY,
          conversationId,
        ]);

        const cancelPromise = cancelQueries();

        await addMessageToConversation(conversationId, userMessage);

        await cancelPromise;

        const updatedMessages = previousConversation?.messages?.length
          ? [...previousConversation.messages, userMessage]
          : [userMessage];

        const response = await streamResponse(updatedMessages, conversationId);
        return response;
      } catch (error) {
        console.error("Failed to send message:", error);
        addError("Failed to send message. Please try again.");
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
      streamResponse,
      addError,
      startLoading,
      addMessageToConversation,
    ],
  );

  const abortStream = useCallback(() => {
    if (controller) {
      controller.abort();
    }
  }, [controller]);

  return {
    streamStarted,
    controller,
    assistantResponseRef,
    assistantReasoningRef,

    sendMessage,
    streamResponse,
    abortStream,
    updateAssistantMessage,
  };
}
