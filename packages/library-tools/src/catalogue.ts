import { ToolError } from "./errors.js";
import { resolveToolPermissions } from "./permissions.js";
import type { ToolDefinition, ToolDescriptor } from "./tool.js";

export interface ToolCatalogue<TTool extends ToolDescriptor<any, any, any>> {
  list(): TTool[];
  resolve(name: string): TTool;
  find(name: string): TTool | undefined;
  repeatLimit(name: string): number | undefined;
  expandCompanions(names: readonly string[]): string[];
}

export function requireToolPermissions(name: string, permissions?: string[]): string[] {
  const resolved = resolveToolPermissions(name, permissions);

  if (resolved.length === 0) {
    throw new ToolError("missing_permissions", `Tool "${name}" is missing explicit permissions`, {
      toolName: name,
    });
  }

  return resolved;
}

export function createToolCatalogue<
  TTool extends ToolDescriptor<any, any, any> | ToolDefinition<any, any, any>,
>(tools: readonly TTool[]): ToolCatalogue<TTool> {
  const entries = new Map<string, TTool>();

  for (const tool of tools) {
    if (entries.has(tool.name)) {
      throw new ToolError("duplicate_registration", `Tool "${tool.name}" is defined twice`, {
        toolName: tool.name,
      });
    }

    entries.set(tool.name, {
      ...tool,
      permissions: requireToolPermissions(tool.name, tool.permissions),
    });
  }

  return {
    list: () => [...entries.values()],
    find: (name) => entries.get(name),
    resolve: (name) => {
      const tool = entries.get(name);

      if (!tool) {
        throw new ToolError("unknown_tool", `Unknown tool "${name}"`, { toolName: name });
      }

      return tool;
    },
    repeatLimit: (name) => entries.get(name)?.maxIdenticalCalls,
    expandCompanions: (names) => {
      const expanded = new Set<string>();

      for (const name of names) {
        expanded.add(name);

        for (const companion of entries.get(name)?.companionTools ?? []) {
          expanded.add(companion);
        }
      }

      return [...expanded];
    },
  };
}
