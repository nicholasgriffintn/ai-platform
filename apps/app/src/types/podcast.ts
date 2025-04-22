export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker: string;
  avg_logprob: number;
};

export type TranscriptData = {
  language: string;
  segments: TranscriptSegment[];
  num_speakers: number;
};

export interface Podcast {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  imageUrl?: string;
  audioUrl: string;
  transcript?: TranscriptData;
  summary?: string;
  duration?: number;
  status: "pending" | "processing" | "complete" | "failed";
}

export interface PodcastFormData {
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
