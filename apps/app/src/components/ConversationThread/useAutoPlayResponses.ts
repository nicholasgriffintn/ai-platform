import { canReplaceStoredConversationMessages } from "@assistant/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiService } from "~/lib/api/api-service";
import { getMessageTextContent } from "~/lib/messages";
import {
	buildMessageSpeech,
	resolveMessageSpeechAudioSource,
	resolveSpeechResponseAudioSource,
	withMessageSpeech,
	type MessageSpeech,
} from "~/lib/speech/message-speech";
import type { Message } from "~/types";
import { useConversationStorage } from "~/hooks/useConversationStorage";

export function useAutoPlayResponses({
	conversationId,
	messages,
	isEnabled,
	isStreaming,
}: {
	conversationId?: string;
	messages: Message[];
	isEnabled: boolean;
	isStreaming: boolean;
}) {
	const { determineStorageMode, updateConversation } = useConversationStorage();
	const [isPlaying, setIsPlaying] = useState(false);
	const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const lastHandledMessageIdRef = useRef<string | undefined>(undefined);
	const generationRequestIdRef = useRef(0);
	const hasSeenStreamingRef = useRef(false);

	const playAudioSource = useCallback((audioSource: string) => {
		const audio = new Audio(audioSource);
		audio.crossOrigin = "use-credentials";
		audioRef.current = audio;
		audio.onended = () => setIsPlaying(false);
		audio.onerror = () => {
			setIsPlaying(false);
			toast.error("Failed to play generated speech");
		};
		setIsGeneratingSpeech(false);
		setIsPlaying(true);
		return audio.play();
	}, []);

	const stopPlayback = useCallback(() => {
		generationRequestIdRef.current += 1;
		const audio = audioRef.current;
		if (audio) {
			audio.pause();
			audio.removeAttribute("src");
			audio.load();
		}
		audioRef.current = null;
		setIsPlaying(false);
		setIsGeneratingSpeech(false);
	}, []);

	const persistMessageSpeech = useCallback(
		async ({ messageId, speech }: { messageId: string; speech: MessageSpeech }) => {
			if (!conversationId) {
				return;
			}

			let updatedMessages: Message[] | undefined;
			await updateConversation(conversationId, (conversation) => {
				if (!conversation) {
					throw new Error("No conversation found to update generated speech");
				}

				updatedMessages = conversation.messages.map((message) =>
					message.id === messageId ? withMessageSpeech(message, speech) : message,
				);

				return {
					...conversation,
					messages: updatedMessages,
				};
			});

			if (
				determineStorageMode().shouldSyncRemote &&
				updatedMessages &&
				canReplaceStoredConversationMessages(updatedMessages)
			) {
				await apiService.updateConversation(conversationId, {
					messages: updatedMessages,
				});
			}
		},
		[conversationId, determineStorageMode, updateConversation],
	);

	useEffect(() => {
		if (!isEnabled) {
			const latestAssistantMessage = messages
				.slice()
				.reverse()
				.find((message) => message.role === "assistant");
			lastHandledMessageIdRef.current = latestAssistantMessage?.id;
			stopPlayback();
		}
	}, [isEnabled, messages, stopPlayback]);

	useEffect(() => {
		return () => {
			stopPlayback();
		};
	}, [stopPlayback]);

	useEffect(() => {
		if (!isEnabled || isStreaming) {
			if (isStreaming) {
				hasSeenStreamingRef.current = true;
			}
			return;
		}

		const latestAssistantMessage = messages
			.slice()
			.reverse()
			.find((message) => message.role === "assistant");

		if (!hasSeenStreamingRef.current) {
			lastHandledMessageIdRef.current = latestAssistantMessage?.id;
			return;
		}
		hasSeenStreamingRef.current = false;

		if (
			!latestAssistantMessage?.id ||
			latestAssistantMessage.id === lastHandledMessageIdRef.current
		) {
			return;
		}

		const existingSpeechSource = resolveMessageSpeechAudioSource(latestAssistantMessage);
		if (existingSpeechSource) {
			lastHandledMessageIdRef.current = latestAssistantMessage.id;
			stopPlayback();
			void playAudioSource(existingSpeechSource).catch(() => {
				toast.error("Failed to play generated speech");
			});
			return;
		}

		const text = getMessageTextContent(latestAssistantMessage);
		if (!text || !conversationId) {
			lastHandledMessageIdRef.current = latestAssistantMessage.id;
			return;
		}

		let isCancelled = false;
		lastHandledMessageIdRef.current = latestAssistantMessage.id;
		stopPlayback();
		const requestId = generationRequestIdRef.current + 1;
		generationRequestIdRef.current = requestId;
		setIsGeneratingSpeech(true);

		apiService
			.generateSpeech(text)
			.then((response) => {
				if (
					isCancelled ||
					generationRequestIdRef.current !== requestId ||
					response.status !== "success"
				) {
					return;
				}

				const speech = buildMessageSpeech(response);
				const audioSource = resolveSpeechResponseAudioSource(response);
				if (!audioSource) {
					setIsGeneratingSpeech(false);
					return;
				}

				const persistSpeech = speech
					? persistMessageSpeech({
							messageId: latestAssistantMessage.id,
							speech,
						})
					: Promise.resolve();

				return persistSpeech.then(() => playAudioSource(audioSource));
			})
			.catch((error) => {
				if (isCancelled || generationRequestIdRef.current !== requestId) {
					return;
				}
				console.error("Failed to auto-play response:", error);
				toast.error("Failed to generate speech for this response");
				setIsGeneratingSpeech(false);
				setIsPlaying(false);
			});

		return () => {
			isCancelled = true;
		};
	}, [
		conversationId,
		isEnabled,
		isStreaming,
		messages,
		persistMessageSpeech,
		playAudioSource,
		stopPlayback,
	]);

	return {
		isGeneratingSpeech,
		isPlaying,
		stopPlayback,
	};
}
