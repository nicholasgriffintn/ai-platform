import { useCallback } from "react";
import type { Message } from "~/types";
import { normalizeMessage } from "~/lib/messages";
import { useConversationStorage } from "./useConversationStorage";
import { useChatStore } from "~/state/stores/chatStore";

/**
 * Hook for managing message operations within conversations.
 * Handles adding, updating, and deleting messages.
 */
export function useMessageOperations() {
	const { updateConversation } = useConversationStorage();
	const { model } = useChatStore();

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

	const addAssistantMessage = useCallback(
		async (
			conversationId: string,
			content: Message["content"],
			reasoning?: string,
			messageData?: Partial<Message>,
		) => {
			const now = Date.now();
			const currentModel = model === null ? undefined : model;

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

			await addMessageToConversation(conversationId, assistantMessage);
			return assistantMessage;
		},
		[model, addMessageToConversation],
	);

	const updateAssistantMessage = useCallback(
		async (
			conversationId: string,
			content: Message["content"],
			reasoning?: string,
			messageData?: Partial<Message>,
			options?: { messageId?: string },
		) => {
			await updateConversation(conversationId, (oldData) => {
				const now = Date.now();
				const nowISOString = new Date(now).toISOString();
				const currentModel = model === null ? undefined : model;

				if (!oldData) {
					throw new Error("No conversation found to update");
				}

				const messages = [...oldData.messages];
				const assistantIndex = (() => {
					if (options?.messageId) {
						return messages.findIndex(
							(message) => message.id === options.messageId && message.role === "assistant",
						);
					}

					for (let i = messages.length - 1; i >= 0; i--) {
						if (messages[i].role === "assistant") {
							return i;
						}
					}
					return -1;
				})();

				if (assistantIndex === -1) {
					throw new Error("No assistant message found to update");
				}

				const lastAssistantMessage = messages[assistantIndex];
				const updatedMessage = normalizeMessage({
					...lastAssistantMessage,
					...messageData,
					role: "assistant",
					content,
					created: messageData?.created || lastAssistantMessage.created || now,
					timestamp: messageData?.timestamp || lastAssistantMessage.timestamp || now,
					model: messageData?.model || currentModel,
					reasoning: reasoning
						? {
								collapsed: true,
								content: reasoning,
							}
						: lastAssistantMessage.reasoning,
				});

				messages[assistantIndex] = updatedMessage;

				return {
					...oldData,
					messages: [...messages],
					updated_at: nowISOString,
					last_message_at: nowISOString,
					created_at: oldData.created_at || nowISOString,
				};
			});
		},
		[model, updateConversation],
	);

	return {
		addMessageToConversation,
		addAssistantMessage,
		updateAssistantMessage,
	};
}
