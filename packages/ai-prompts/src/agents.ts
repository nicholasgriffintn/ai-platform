import { getPromptText, renderPrompt } from "./prompts.js";

export interface AgentSystemPromptOptions {
  name: string;
  role?: string | null;
  objective?: string | null;
  instructions?: string | null;
}

export function buildAgentSystemPrompt({
  name,
  role,
  objective,
  instructions,
}: AgentSystemPromptOptions): string {
  return [
    role
      ? renderPrompt("agents/identity/with-role", { agentName: name, agentRole: role })
      : renderPrompt("agents/identity/no-role", { agentName: name }),
    objective ? renderPrompt("agents/objective", { objective }) : undefined,
    instructions,
    getPromptText("agents/execution"),
  ]
    .filter(Boolean)
    .join("\n\n");
}
