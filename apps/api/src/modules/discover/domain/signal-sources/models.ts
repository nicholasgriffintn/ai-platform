import { first, items, lines, joinParts } from "./read";
import type { DiscoverSignal } from "./types";

export const MODEL_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "artificial-analysis-models",
    providerId: "artificial_analysis",
    group: "models",
    title: "Artificial Analysis",
    description: "Reads the current language model index.",
    operation: "ARTIFICIAL_ANALYSIS_LIST_LANGUAGE_MODELS",
    parameters: () => ({}),
    digest: (result) =>
      lines(
        items(result, ["data", "data"], ["data"]),
        (model) =>
          joinParts(
            first(model, ["name"]),
            first(model, ["model_creator", "name"]),
            first(model, ["evaluations", "artificial_analysis_intelligence_index"]) &&
              `index ${first(model, ["evaluations", "artificial_analysis_intelligence_index"])}`,
          ),
        8,
      ),
  },
];
