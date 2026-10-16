import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "~/types/functions";

export const RESEARCH_DEPTHS = ["quick", "standard", "deep"] as const;
export const RESEARCH_FORMATS = ["report", "data"] as const;

export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];
export type ResearchFormat = (typeof RESEARCH_FORMATS)[number];

export const research: FunctionToolDescriptor = {
  name: "research",
  description:
    "Runs slow, paid deep web research across many sources and returns a cited synthesis. Use it for market analysis, due diligence or questions that need many sources; use web_search for a quick fact. Load the web-research skill first when the brief is vague.",
  type: "byok",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      input: {
        type: "string",
        description:
          "The research brief: the question, why it matters, and any scope such as timeframe, region or sources to prefer.",
      },
      depth: {
        type: "string",
        enum: [...RESEARCH_DEPTHS],
        description:
          "quick for a short sourced answer in a minute or two, standard for a thorough report, deep for exhaustive due diligence. Defaults to standard.",
      },
      format: {
        type: "string",
        enum: [...RESEARCH_FORMATS],
        description:
          "report for prose with citations, data for structured fields. Defaults to report.",
      },
      output_description: {
        type: "string",
        description: "Optional description of what the report or data should contain.",
      },
      provider: {
        type: "string",
        enum: ["parallel", "exa"],
        description: "Research provider. Defaults to parallel.",
      },
    },
    required: ["input"],
    additionalProperties: false,
  }),
};
