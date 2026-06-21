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
