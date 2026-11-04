const MAX_CONNECTED_APPS = 12;

export interface CapabilityMapGroup {
  label: string;
  tools: string[];
}

export interface CapabilityMap {
  groups: CapabilityMapGroup[];
  connectedApps: string[];
}

export function buildCapabilityMap(input: {
  tools: readonly { name: string; category: string; hint?: string }[];
  connectedApps: readonly string[];
}): CapabilityMap | null {
  const byCategory = new Map<string, Set<string>>();

  for (const tool of input.tools) {
    const entry = tool.hint ? `${tool.name} (${tool.hint})` : tool.name;

    byCategory.set(tool.category, (byCategory.get(tool.category) ?? new Set()).add(entry));
  }

  const groups = [...byCategory]
    .map(([label, tools]) => ({ label, tools: [...tools].sort() }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const connectedApps = [...new Set(input.connectedApps)]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_CONNECTED_APPS);

  return groups.length > 0 || connectedApps.length > 0 ? { groups, connectedApps } : null;
}
