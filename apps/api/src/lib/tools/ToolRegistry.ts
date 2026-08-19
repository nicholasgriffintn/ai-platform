import { CategoryRegistry, isRegistryError } from "@ngriffin_uk/polychat-library-registry";
import type { ToolDefinition, ToolResult } from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";

import type { ToolExecutionContext } from "./ToolExecutionContext";

export type ToolCategory = string;
export type ToolLifecycle = "singleton" | "transient";

export type RegisteredToolDefinition<
  TInput = unknown,
  TResult extends ToolResult = ToolResult,
> = ToolDefinition<TInput, TResult, ToolExecutionContext>;

export interface ToolRegistration<TInput = unknown, TResult extends ToolResult = ToolResult> {
  name: string;
  aliases?: string[];
  lifecycle?: ToolLifecycle;
  metadata?: Record<string, unknown>;
  create: () => RegisteredToolDefinition<TInput, TResult>;
}

export interface ToolSummary {
  name: string;
  category: ToolCategory;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  permissions?: string[];
}

function toAssistantError(error: unknown, category: ToolCategory): unknown {
  if (!isRegistryError(error)) {
    return error;
  }

  if (error.code === "duplicate_registration") {
    return new AssistantError(
      `Tool "${error.entryName}" already registered for category "${category}"`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (error.code === "unknown_category") {
    return new AssistantError(
      `No tools registered for category "${category}"`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return new AssistantError(
    `Unknown ${category} tool "${error.entryName}"`,
    ErrorType.PARAMS_ERROR,
    500,
    {
      category,
      reason: "unknown_tool",
      toolName: error.entryName,
    },
  );
}

export class ToolRegistry {
  private readonly registry = new CategoryRegistry<
    Record<ToolCategory, RegisteredToolDefinition>
  >();

  register(category: ToolCategory, registration: ToolRegistration): void {
    try {
      this.registry.register(category, registration);
    } catch (error) {
      throw toAssistantError(error, category);
    }
  }

  resolve(category: ToolCategory, toolName: string): RegisteredToolDefinition {
    try {
      return this.registry.resolve(category, toolName, undefined);
    } catch (error) {
      throw toAssistantError(error, category);
    }
  }

  list(category?: ToolCategory): ToolSummary[] {
    return this.registry.listEntries(category).map((entry) => ({
      name: entry.name,
      category: entry.category,
      aliases: entry.aliases,
      metadata: entry.metadata,
      permissions: entry.instance?.permissions,
    }));
  }

  listDefinitions(category: ToolCategory): RegisteredToolDefinition[] {
    return this.registry.listEntries(category).map((entry) => this.resolve(category, entry.name));
  }
}
