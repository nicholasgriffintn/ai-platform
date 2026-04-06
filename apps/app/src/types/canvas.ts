export type CanvasMode = "image" | "video";
export type CanvasGenerationStatus =
	| "queued"
	| "processing"
	| "succeeded"
	| "completed"
	| "failed";

export interface CanvasInputField {
	name: string;
	type: string | string[];
	description?: string;
	required: boolean;
	default?: unknown;
	enum?: unknown[];
}

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
		fields: CanvasInputField[];
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
	provider?: string;
	status: CanvasGenerationStatus;
	generationId?: string;
	error?: string;
}

export interface CanvasGeneration {
	id: string;
	itemId?: string;
	modelId: string;
	modelName?: string;
	provider?: string;
	mode?: CanvasMode;
	status: CanvasGenerationStatus;
	createdAt?: string;
	updatedAt?: string;
	input?: Record<string, unknown>;
	output?: unknown;
	error?: string;
	predictionData?: unknown;
}

export interface CanvasGenerateResponse {
	generations: CanvasGenerationResult[];
}

export interface CanvasGenerationsResponse {
	generations: CanvasGeneration[];
}
