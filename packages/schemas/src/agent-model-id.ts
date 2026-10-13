export const AGENT_MODEL_ID_PREFIX = "agent/";

export function agentModelId(name: string): string {
  return `${AGENT_MODEL_ID_PREFIX}${name}`;
}

export function isAgentModelId(modelId: string | undefined): boolean {
  return modelId?.startsWith(AGENT_MODEL_ID_PREFIX) ?? false;
}
