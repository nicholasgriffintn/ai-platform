import type { ReplicateInputField } from "~/types/replicate";

export type CanvasMode = "image" | "video";

export interface CanvasModel {
	id: string;
	name: string;
	description?: string;
	provider: string;
	costPerRun?: number;
	requiresReferenceImage?: boolean;
	modalities: {
		input: string[];
		output?: string[];
	};
	strengths?: string[];
	isFeatured?: boolean;
	inputSchema?: {
		fields: ReplicateInputField[];
		reference?: string;
	};
}

export interface CanvasGenerateRequest {
	mode: CanvasMode;
	prompt: string;
	modelIds: string[];
	referenceImages?: string[];
	negativePrompt?: string;
	aspectRatio?: string;
	resolution?: string;
	width?: number;
	height?: number;
	durationSeconds?: number;
	generateAudio?: boolean;
}

export interface CanvasGenerationResult {
	modelId: string;
	modelName: string;
	status: "queued" | "failed";
	predictionId?: string;
	error?: string;
}

export interface CanvasGenerateResponse {
	generations: CanvasGenerationResult[];
}
