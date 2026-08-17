import type { DrawingStudioState } from "../Drawing/controller";
import type { CanvasRun } from "./GenerationCard";
import type { CanvasInputField, CanvasMode, CanvasModel } from "./types";

export type CanvasStudioMode = CanvasMode | "drawing";

export type CanvasOptionValues = Record<string, string | boolean>;

/**
 * The contract the host controller fulfils for the canvas views. Hosts own the queries, mutations,
 * and persistence; these views only present the resulting state and emit intents.
 */
export interface CanvasStudioState {
	mode: CanvasStudioMode;
	mediaMode: CanvasMode;
	drawing: DrawingStudioState;
	prompt: string;
	negativePrompt: string;
	referenceInput: string;
	aspectRatio: string;
	resolution: string;
	modelSearch: string;
	modelOptionFields: CanvasInputField[];
	modelOptionValues: CanvasOptionValues;
	selectedModelIds: string[];
	visibleModels: CanvasModel[];
	aspectRatioOptions: string[];
	resolutionOptions: string[];
	displayRuns: CanvasRun[];
	isModelsLoading: boolean;
	isGenerating: boolean;
	error: Error | null;
	setPrompt: (prompt: string) => void;
	setNegativePrompt: (prompt: string) => void;
	setReferenceInput: (value: string) => void;
	setAspectRatio: (value: string) => void;
	setResolution: (value: string) => void;
	setModelSearch: (value: string) => void;
	setModelOptionValue: (fieldName: string, value: string | boolean) => void;
	handleModeChange: (mode: CanvasStudioMode) => void;
	handleModelToggle: (modelId: string) => void;
	handleGenerate: () => Promise<void> | void;
}
