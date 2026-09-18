import { declareTool, type ToolDeclaration } from "./declaration.js";

export const UPDATE_PLAN_TOOL_NAME = "update_plan";
export const FINISH_TOOL_NAME = "finish";

export const AGENT_CONTROL_TOOL_NAMES: ReadonlySet<string> = new Set([
  UPDATE_PLAN_TOOL_NAME,
  FINISH_TOOL_NAME,
]);

export const updatePlanToolDeclaration: ToolDeclaration = declareTool({
  name: UPDATE_PLAN_TOOL_NAME,
  description:
    "Record the current plan before continuing. Use when the strategy changes or after a failure requires a different approach.",
  parameters: {
    plan: {
      type: "string",
      description: "The revised plan, as a short ordered list of the next concrete steps.",
    },
    reasoning: {
      type: "string",
      description: "Why the plan changed.",
    },
  },
  required: ["plan"],
});

export const finishToolDeclaration: ToolDeclaration = declareTool({
  name: FINISH_TOOL_NAME,
  description:
    "Finish the run and report the outcome. Only call this once the work is genuinely complete and supported by evidence gathered during the run.",
  parameters: {
    summary: {
      type: "string",
      description: "What was done, what evidence supports it, and anything left outstanding.",
    },
  },
  required: ["summary"],
});

export const teammateControlToolDeclarations: ToolDeclaration[] = [
  updatePlanToolDeclaration,
  finishToolDeclaration,
];
