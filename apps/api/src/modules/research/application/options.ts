import type { ResearchOptions } from "~/types";

import type { ResearchDepth, ResearchFormat } from "./tools/definitions/research";

const PARALLEL_PROCESSORS: Record<ResearchDepth, string> = {
  quick: "base",
  standard: "pro",
  deep: "ultra",
};

const EXA_MODELS: Record<ResearchDepth, string> = {
  quick: "exa-research",
  standard: "exa-research",
  deep: "exa-research-pro",
};

export interface ResearchRequestShape {
  depth: ResearchDepth;
  format: ResearchFormat;
  provider: "parallel" | "exa";
  output_description?: string;
}

export function researchOptionsFor(args: ResearchRequestShape): ResearchOptions {
  if (args.provider === "exa") {
    return { model: EXA_MODELS[args.depth] };
  }

  return {
    processor: PARALLEL_PROCESSORS[args.depth],
    task_spec: {
      output_schema: {
        type: args.format === "data" ? "auto" : "text",
        ...(args.output_description ? { description: args.output_description } : {}),
      },
    },
  };
}
