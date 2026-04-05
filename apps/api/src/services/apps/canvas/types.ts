import type { ModelConfigItem } from "~/types";

export type CanvasMode = "image" | "video";

export interface CanvasGenerationInput {
	mode: CanvasMode;
	prompt: string;
	negativePrompt?: string;
	referenceImages?: string[];
	aspectRatio?: string;
	resolution?: string;
	width?: number;
	height?: number;
	durationSeconds?: number;
	generateAudio?: boolean;
}

export interface CanvasGenerateParams extends CanvasGenerationInput {
	modelIds: string[];
}

export interface CanvasModelListItem {
	id: string;
	name: string;
	description?: string;
	provider: string;
	costPerRun?: number;
	modalities: ModelConfigItem["modalities"];
	strengths?: string[];
	isFeatured?: boolean;
	requiresReferenceImage?: boolean;
	inputSchema?: ModelConfigItem["inputSchema"];
}
