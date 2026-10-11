export const HOSTED_AGENT_MAX_INPUT_CHARS = 100_000;
export const HOSTED_AGENT_MAX_INSTRUCTIONS_CHARS = 12_000;

export function buildHostedAgentInstructions(systemPrompt?: string): string | undefined {
  const instructions = systemPrompt?.trim();

  if (!instructions) {
    return undefined;
  }

  return instructions.length > HOSTED_AGENT_MAX_INSTRUCTIONS_CHARS
    ? instructions.slice(-HOSTED_AGENT_MAX_INSTRUCTIONS_CHARS)
    : instructions;
}

export function truncateAgentInput(input: string): string {
  const trimmed = input.trim();

  return trimmed.length > HOSTED_AGENT_MAX_INPUT_CHARS
    ? trimmed.slice(-HOSTED_AGENT_MAX_INPUT_CHARS)
    : trimmed;
}

export function resolveAgentNetworkHosts(options: unknown): string[] {
  if (!options || typeof options !== "object") {
    return [];
  }

  const sandbox = (options as { sandbox?: { environmentSetup?: unknown } }).sandbox
    ?.environmentSetup;

  if (!sandbox || typeof sandbox !== "object") {
    return [];
  }

  const definition =
    (sandbox as { source?: unknown; definition?: { networkHosts?: unknown } }).source === "polychat"
      ? (sandbox as { definition?: { networkHosts?: unknown } }).definition
      : undefined;
  const hosts = definition?.networkHosts;

  if (!Array.isArray(hosts)) {
    return [];
  }

  return hosts
    .filter((host): host is string => typeof host === "string" && host.length > 0)
    .slice(0, 32);
}
