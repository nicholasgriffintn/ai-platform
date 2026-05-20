import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiService } from "~/lib/api/api-service";
import { getMessageTextContent } from "~/lib/messages";
import type { Message } from "~/types";

function resolveSpeechAudioSource(response: Awaited<ReturnType<typeof apiService.generateSpeech>>) {
	const { audioDataUrl, audioBase64, audioMimeType, audioUrl } = response.data;

	if (audioDataUrl) {
		return audioDataUrl;
	}

	if (audioBase64) {
		return `data:${audioMimeType || "audio/mpeg"};base64,${audioBase64}`;
	}

	return audioUrl;
}

export function useAutoPlayResponses({
	messages,
	isEnabled,
	isStreaming,
}: {
	messages: Message[];
	isEnabled: boolean;
	isStreaming: boolean;
}) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const lastHandledMessageIdRef = useRef<string | undefined>(undefined);
	const generationRequestIdRef = useRef(0);

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
			return;
		}

		const latestAssistantMessage = messages
			.slice()
			.reverse()
			.find((message) => message.role === "assistant");

		if (
			!latestAssistantMessage?.id ||
			latestAssistantMessage.id === lastHandledMessageIdRef.current
		) {
			return;
		}

		const text = getMessageTextContent(latestAssistantMessage);
		if (!text) {
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
			.generateSpeech(text, { store: false })
			.then((response) => {
				if (
					isCancelled ||
					generationRequestIdRef.current !== requestId ||
					response.status !== "success"
				) {
					return;
				}

				const audioSource = resolveSpeechAudioSource(response);
				if (!audioSource) {
					setIsGeneratingSpeech(false);
					return;
				}

				const audio = new Audio(audioSource);
				audioRef.current = audio;
				audio.onended = () => setIsPlaying(false);
				audio.onerror = () => {
					setIsPlaying(false);
					toast.error("Failed to play generated speech");
				};
				setIsGeneratingSpeech(false);
				setIsPlaying(true);
				return audio.play();
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
	}, [isEnabled, isStreaming, messages, stopPlayback]);

	return {
		isGeneratingSpeech,
		isPlaying,
		stopPlayback,
	};
}
