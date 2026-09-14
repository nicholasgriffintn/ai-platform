export interface RecordingFormData {
  title: string;
  description: string;
  audioFile: File | null;
  audioUrl: string;
  audioSource: "file" | "url";
  transcribe: boolean;
  summarise: boolean;
  generateImage: boolean;
  imagePrompt: string;
  transcribePrompt: string;
  numberOfSpeakers: number;
  speakers: Record<string, string>;
}

export const DEFAULT_RECORDING_NUMBER_OF_SPEAKERS = 2;

export function createRecordingSpeakers(
  count: number,
  existing: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const speakerId = String(index + 1);

      return [speakerId, existing[speakerId] ?? `Speaker ${speakerId}`];
    }),
  );
}

export const DEFAULT_RECORDING_SPEAKERS = createRecordingSpeakers(
  DEFAULT_RECORDING_NUMBER_OF_SPEAKERS,
);

export function getRecordingSpeakerCount(recording: { transcript?: unknown }): number {
  const transcript = recording.transcript;

  if (transcript && typeof transcript === "object" && "num_speakers" in transcript) {
    const count = transcript.num_speakers;

    if (typeof count === "number" && count > 0) {
      return count;
    }
  }

  return DEFAULT_RECORDING_NUMBER_OF_SPEAKERS;
}

export interface UploadRecordingParams {
  title: string;
  description?: string;
  audio?: File;
  audioUrl?: string;
}

export interface UploadResponse {
  response: {
    completion_id: string;
    status: string;
    content: string;
    data: {
      title: string;
      description?: string;
      audioUrl: string;
      imageKey?: string;
      signedUrl?: string;
      status: string;
      createdAt: string;
    };
  };
}

export interface ProcessRecordingParams {
  recordingId: string;
  action: "transcribe" | "summarise" | "generate-image";
  prompt?: string;
  numberOfSpeakers?: number;
  speakers?: Record<string, string>;
}
