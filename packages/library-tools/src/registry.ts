import { CategoryRegistry, isRegistryError } from "@ngriffin_uk/polychat-library-registry";

import { ToolError } from "./errors.js";
import type { ToolDefinition } from "./tool.js";

export type ToolLifecycle = "singleton" | "transient";

export interface ToolRegistration<TDefinition extends ToolDefinition<any, any, any>> {
  name: string;
  aliases?: string[];
  lifecycle?: ToolLifecycle;
  metadata?: Record<string, unknown>;
  create: () => TDefinition;
}

export interface ToolSummary {
  name: string;
  category: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  permissions?: string[];
}

function toToolError(error: unknown, category: string): unknown {
  if (!isRegistryError(error)) {
    return error;
  }

  const details = { category, toolName: error.entryName };

  switch (error.code) {
    case "duplicate_registration":
      return new ToolError(
        "duplicate_registration",
        `Tool "${error.entryName}" already registered for category "${category}"`,
        details,
      );
    case "unknown_category":
      return new ToolError(
        "unknown_category",
        `No tools registered for category "${category}"`,
        details,
      );
    default:
      return new ToolError(
        "unknown_tool",
        `Unknown ${category} tool "${error.entryName}"`,
        details,
      );
  }
}

export class ToolRegistry<
  TDefinition extends ToolDefinition<any, any, any> = ToolDefinition<any, any, any>,
> {
  private readonly registry = new CategoryRegistry<Record<string, TDefinition>>();

  register(category: string, registration: ToolRegistration<TDefinition>): void {
    try {
      this.registry.register(category, registration);
    } catch (error) {
      throw toToolError(error, category);
    }
  }

  resolve(category: string, toolName: string): TDefinition {
    try {
      return this.registry.resolve(category, toolName, undefined);
    } catch (error) {
      throw toToolError(error, category);
    }
  }

  has(category: string, toolName: string): boolean {
    return this.registry.has(category, toolName);
  }

  list(category?: string): ToolSummary[] {
    return this.registry.listEntries(category).map((entry) => ({
      name: entry.name,
      category: entry.category,
      aliases: entry.aliases,
      metadata: entry.metadata,
      permissions: entry.instance?.permissions,
    }));
  }

  listDefinitions(category: string): TDefinition[] {
    return this.registry.listEntries(category).map((entry) => this.resolve(category, entry.name));
  }
}
