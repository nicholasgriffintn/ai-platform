import type { SpeechGenerationResponse } from "~/lib/api/services/audio-service";
import type { Message, MessageData } from "~/types";

export type MessageSpeech = NonNullable<MessageData["speech"]>;

export function resolveSpeechResponseAudioSource(
	response: SpeechGenerationResponse,
): string | undefined {
	const { audioDataUrl, audioBase64, audioMimeType, audioUrl } = response.data;

	if (audioUrl) {
		return audioUrl;
	}

	if (audioDataUrl) {
		return audioDataUrl;
	}

	if (audioBase64) {
		return `data:${audioMimeType || "audio/mpeg"};base64,${audioBase64}`;
	}

	return undefined;
}

export function buildMessageSpeech(response: SpeechGenerationResponse): MessageSpeech | undefined {
	const audioSource = resolveSpeechResponseAudioSource(response);
	if (!audioSource) {
		return undefined;
	}

	return {
		audioBase64: response.data.audioBase64,
		audioDataUrl: response.data.audioDataUrl,
		audioKey: response.data.audioKey,
		audioMimeType: response.data.audioMimeType,
		audioUrl: response.data.audioUrl,
		generatedAt: Date.now(),
		model: response.data.model,
		provider: response.data.provider,
	};
}

export function resolveMessageSpeechAudioSource(message: Message): string | undefined {
	const speech = message.data?.speech;
	if (!speech) {
		return undefined;
	}

	if (speech.audioUrl) {
		return speech.audioUrl;
	}

	if (speech.audioDataUrl) {
		return speech.audioDataUrl;
	}

	if (speech.audioBase64) {
		return `data:${speech.audioMimeType || "audio/mpeg"};base64,${speech.audioBase64}`;
	}

	return undefined;
}

export function withMessageSpeech(message: Message, speech: MessageSpeech): Message {
	return {
		...message,
		data: {
			...message.data,
			speech,
		},
	};
}
