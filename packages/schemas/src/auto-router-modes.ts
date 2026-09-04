import type { ModelRouterMode } from "./chat-completions";
import {
  doesModelMatchRouterMode,
  isActiveRouterModel,
  sortModelsByRouterModeFit,
} from "./model-router-modes";
import type { ModelConfigItem } from "./models";

export interface AutoRouterModeDefinition {
  id: ModelRouterMode;
  label: string;
  tagline: string;
  description: string;
  filterSummary: string;
}

export const AUTO_ROUTER_MODES: readonly AutoRouterModeDefinition[] = [
  {
    id: "auto",
    label: "Auto",
    tagline: "Let the router decide",
    description: "Selects from eligible text-response chat models for the request.",
    filterSummary: "Available text-response chat models",
  },
  {
    id: "lite",
    label: "Lite",
    tagline: "Fast, lower-cost automation",
    description: "Prefers efficient models for quick questions, drafts, and summaries.",
    filterSummary: "Fast models with low token cost",
  },
  {
    id: "standard",
    label: "Standard",
    tagline: "Balanced automation",
    description: "Prefers balanced everyday models with solid speed and capability.",
    filterSummary: "Balanced speed, cost, and capability",
  },
  {
    id: "pro",
    label: "Pro",
    tagline: "More capable automation",
    description: "Prefers stronger reasoning, analysis, coding, and tool-use models.",
    filterSummary: "Advanced reasoning and tool-use models",
  },
  {
    id: "max",
    label: "Max",
    tagline: "Highest-capability automation",
    description: "Prefers the strongest available models for demanding work.",
    filterSummary: "Top complexity, reliability, or intelligence scores",
  },
];

export function doesModelMatchAutoRouterMode(model: ModelConfigItem, mode: ModelRouterMode) {
  if (!isActiveRouterModel(model)) {
    return false;
  }

  return doesModelMatchRouterMode(model, mode);
}

export function countAutoRouterModeCandidates(models: ModelConfigItem[], mode: ModelRouterMode) {
  return models.filter((model) => doesModelMatchAutoRouterMode(model, mode)).length;
}

export function getAutoRouterModeCandidates(models: ModelConfigItem[], mode: ModelRouterMode) {
  return sortModelsByRouterModeFit(
    models.filter((model) => doesModelMatchAutoRouterMode(model, mode)),
    mode,
  );
}

export function getAutoRouterModeDefinition(mode: ModelRouterMode) {
  return AUTO_ROUTER_MODES.find((definition) => definition.id === mode) ?? AUTO_ROUTER_MODES[0];
}
