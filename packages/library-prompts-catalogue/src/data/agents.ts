import type { PromptEntry } from "../schema.js";

export const agentPromptEntries = [
  {
    id: "agents/identity/with-role",
    task: "agent-runner",
    title: "Agent identity: with role",
    description: "Opening identity line for an agent definition that includes a role.",
    text: "You are {{agentName}}, {{agentRole}}.",
    variables: [
      { name: "agentName", description: "Agent definition name." },
      { name: "agentRole", description: "Agent definition role." },
    ],
  },
  {
    id: "agents/identity/no-role",
    task: "agent-runner",
    title: "Agent identity: without role",
    description: "Opening identity line for an agent definition without a role.",
    text: "You are {{agentName}}.",
    variables: [{ name: "agentName", description: "Agent definition name." }],
  },
  {
    id: "agents/objective",
    task: "agent-runner",
    title: "Agent objective line",
    description: "Optional objective line for an agent definition.",
    text: "Objective: {{objective}}",
    variables: [{ name: "objective", description: "Agent definition objective." }],
  },
  {
    id: "agents/execution",
    task: "agent-runner",
    title: "Agent execution workflow",
    description: "Closing workflow instruction that tells the agent to work step by step.",
    text: "Work step by step with the tools available. Call update_plan when the strategy changes and finish with a summary when the objective is met.",
  },
] as const satisfies readonly PromptEntry[];
