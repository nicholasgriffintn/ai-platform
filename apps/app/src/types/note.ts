export interface Attachment {
  url: string;
  type: "image" | "document" | "markdown_document" | "audio" | "video";
  name?: string;
  size?: number;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  attachments?: Attachment[];
}
