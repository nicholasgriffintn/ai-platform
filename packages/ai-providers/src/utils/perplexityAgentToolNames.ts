const RESERVED_TOOL_NAMES = new Set([
  "connector",
  "fetch_url",
  "finance_search",
  "image_search",
  "mcp",
  "people_search",
  "sandbox",
  "web_search",
]);
const RESERVED_TOOL_NAME_PREFIX = "polychat_";

export function toPerplexityAgentToolName(name: string): string {
  return RESERVED_TOOL_NAMES.has(name) ? `${RESERVED_TOOL_NAME_PREFIX}${name}` : name;
}

export function fromPerplexityAgentToolName(name: string): string {
  const original = name.startsWith(RESERVED_TOOL_NAME_PREFIX)
    ? name.slice(RESERVED_TOOL_NAME_PREFIX.length)
    : name;

  return RESERVED_TOOL_NAMES.has(original) ? original : name;
}
