import type { ModelConfigItem } from "@assistant/schemas";

export type {
	ModelConfig,
	ModelConfigItem,
	ModelModality,
	ModelRanking,
	ModelReasoningConfig,
	ModelVerbosityConfig,
} from "@assistant/schemas";

export type ModelSelectorScope = "default" | "text-only" | "live" | "chat-and-live";

export type ModelSelectionChangeHandler = (modelId: string | null, model?: ModelConfigItem) => void;
