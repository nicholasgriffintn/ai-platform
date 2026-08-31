import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const set_goal: FunctionToolDescriptor = {
  name: "set_goal",
  description:
    "Set a persistent objective for this conversation when the user asks you to keep working until something is true. The objective survives turns and is only complete once the evidence supports it.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      objective: {
        type: "string",
        description:
          "What should be true when the work is done, stated so it can be checked against evidence.",
      },
    },
    required: ["objective"],
  }),
  type: "premium",
  permissions: ["write"],
};

export const complete_goal: FunctionToolDescriptor = {
  name: "complete_goal",
  description:
    "Mark the active goal complete. Only call this once the objective is satisfied and you can cite the evidence for it. An empty or entirely blocked ledger is a blocker report, not a completion. In a project task, use ask_user for missing human input; a blocked ledger must refer to a recorded failing tool dependency.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "What was achieved, and anything still outstanding.",
      },
      evidence: {
        type: "array",
        minItems: 1,
        description: "One entry per claim the objective depends on.",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "The part of the objective this speaks to." },
            route: {
              type: "string",
              description: "How it was established: what was run, read, or changed.",
            },
            evidence_surface: {
              type: "string",
              description: "Where the evidence lives: a tool result, run id, file, or source.",
            },
            status: {
              type: "string",
              enum: ["confirmed", "approximate", "supporting", "blocked"],
              description: "How strongly the evidence supports the claim.",
            },
            remaining_uncertainty: {
              type: "string",
              description: "What is still unproven about this claim.",
            },
          },
          required: ["claim", "route", "evidence_surface", "status"],
        },
      },
    },
    required: ["summary", "evidence"],
  }),
  type: "premium",
  permissions: ["reasoning"],
};
