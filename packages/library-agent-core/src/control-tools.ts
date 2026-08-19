export const UPDATE_PLAN_TOOL_NAME = "update_plan";
export const FINISH_TOOL_NAME = "finish";

export const AGENT_CONTROL_TOOL_NAMES = new Set([UPDATE_PLAN_TOOL_NAME, FINISH_TOOL_NAME]);

export interface AgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const updatePlanToolDefinition: AgentToolDefinition = {
  type: "function",
  function: {
    name: UPDATE_PLAN_TOOL_NAME,
    description:
      "Record the current plan before continuing. Use when the strategy changes or after a failure requires a different approach.",
    parameters: {
      type: "object",
      properties: {
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
    },
  },
};

export const finishToolDefinition: AgentToolDefinition = {
  type: "function",
  function: {
    name: FINISH_TOOL_NAME,
    description:
      "Finish the run and report the outcome. Only call this once the work is genuinely complete and supported by evidence gathered during the run.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "What was done, what evidence supports it, and anything left outstanding.",
        },
      },
      required: ["summary"],
    },
  },
};
