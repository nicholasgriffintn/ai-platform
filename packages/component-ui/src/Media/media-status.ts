export type MediaState = "idle" | "making" | "ready" | "failed";

export interface MediaStatus {
  state: MediaState;
  label: string;
}

export interface MediaTranscriptSegment {
  start?: number;
  speaker?: string;
  text: string;
}

export interface MediaTranscript {
  segments: readonly MediaTranscriptSegment[];
  speakers?: Readonly<Record<string, string>>;
}
