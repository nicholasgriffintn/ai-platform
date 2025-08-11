import type { Note } from "~/types/note";

export type VideoNoteProcessingStatus = "pending" | "processing" | "complete" | "error";

export interface VideoMetadata {
  originalUrl: string;
  platform: "youtube" | "vimeo" | "direct" | "unknown";
  videoTitle?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface VideoNote extends Note {
  transcript?: string;
  processingStatus?: VideoNoteProcessingStatus;
  metadata?: Record<string, any> & VideoMetadata;
}

export interface VideoNoteCreationRequest {
  url: string;
  timestamps?: boolean;
  provider?: "workers" | "mistral";
  generateSummary?: boolean;
}

export interface VideoNoteResponse {
  noteId: string;
  processingStatus: VideoNoteProcessingStatus;
  transcript?: string;
  metadata?: VideoMetadata & Record<string, any>;
}