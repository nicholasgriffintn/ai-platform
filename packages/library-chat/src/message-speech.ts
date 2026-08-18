import type { Message, MessageData } from "./conversation-types";

export type MessageSpeech = NonNullable<MessageData["speech"]>;

export interface SpeechAudioResponse {
  data: {
    audioDataUrl?: string;
    audioBase64?: string;
    audioMimeType?: string;
    audioUrl?: string;
    audioOutputId?: string;
    audioKey?: string;
    model?: string;
    provider?: string;
  };
}

export function resolveSpeechResponseAudioSource(
  response: SpeechAudioResponse,
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

export function buildMessageSpeech(response: SpeechAudioResponse): MessageSpeech | undefined {
  const audioSource = resolveSpeechResponseAudioSource(response);

  if (!audioSource) {
    return undefined;
  }

  return {
    audioOutputId: response.data.audioOutputId,
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
