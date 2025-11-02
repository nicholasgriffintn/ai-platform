export interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
	speaker: string;
	avg_logprob: number;
}

export interface TranscriptData {
	language: string;
	segments: TranscriptSegment[];
	num_speakers: number;
}

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

export interface UploadPodcastParams {
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

export interface ProcessPodcastParams {
	podcastId: string;
	action: "transcribe" | "summarise" | "generate-image";
	prompt?: string;
	numberOfSpeakers?: number;
	speakers?: Record<string, string>;
}

export interface PodcastsResponse {
	podcasts: Podcast[];
}

export interface PodcastResponse {
	podcast: Podcast;
}
