import type { ModelConfigItem } from "./models.js";

export type ModelSelectorScope = "default" | "text-only" | "live" | "chat-and-live";

export type ModelSelectionChangeHandler = (modelId: string | null, model?: ModelConfigItem) => void;
