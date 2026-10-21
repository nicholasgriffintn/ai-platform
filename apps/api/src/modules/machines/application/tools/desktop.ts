import type { DesktopToolInput, DesktopToolResult } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import type { ApiToolDefinition, FunctionToolDescriptor } from "~/types/functions";

import { runDesktopTool, type DesktopWorkspace } from "../desktop-tools";
import {
  desktop_list_directory as listDescriptor,
  desktop_read_file as readDescriptor,
  desktop_search_files as searchDescriptor,
  desktop_write_file as writeDescriptor,
} from "./definitions/desktop";

function describeResult(workspace: DesktopWorkspace, result: DesktopToolResult): string {
  const where = `${workspace.directory.label} on ${workspace.machineLabel}`;

  switch (result.tool) {
    case "list_directory":
      return result.entries.length === 0
        ? `${result.path || workspace.directory.label} in ${where} is empty.`
        : `${result.path || workspace.directory.label} in ${where}:\n${result.entries
            .map((entry) =>
              entry.kind === "directory"
                ? `${entry.name}/`
                : `${entry.name}${entry.size === null ? "" : ` (${entry.size} bytes)`}`,
            )
            .join("\n")}${result.truncated ? "\n… more entries not shown" : ""}`;
    case "read_file":
      return `${result.path} (${result.size} bytes${result.truncated ? ", cut short" : ""}):\n${result.content}`;
    case "search_files":
      return result.matches.length === 0
        ? `Nothing matched in ${where}.`
        : `${result.matches
            .map((match) =>
              match.line === null
                ? match.path
                : `${match.path}:${match.line}: ${match.excerpt ?? ""}`,
            )
            .join("\n")}${result.truncated ? "\n… more matches not shown" : ""}`;
    case "write_file":
      return `${result.created ? "Created" : "Replaced"} ${result.path} in ${where} (${result.bytes} bytes).`;
  }
}

function defineDesktopTool(
  descriptor: FunctionToolDescriptor,
  toInput: (args: Record<string, unknown>) => DesktopToolInput,
): ApiToolDefinition {
  return {
    ...descriptor,
    execute: async (args, toolContext) => {
      const context = resolveServiceContext(toolContext.request);

      try {
        const { workspace, result } = await runDesktopTool(context, {
          machineId: typeof args.machineId === "string" ? args.machineId : undefined,
          directory: typeof args.directory === "string" ? args.directory : undefined,
          input: toInput(args),
        });

        return {
          status: "success",
          name: descriptor.name,
          content: describeResult(workspace, result),
          data: {
            machineId: workspace.machineId,
            directory: workspace.directory,
            result,
            formattedName: `${workspace.directory.label} on ${workspace.machineLabel}`,
          },
        };
      } catch (error) {
        return {
          status: "error",
          name: descriptor.name,
          content: getErrorMessage(error, "The desktop could not run that."),
          data: error instanceof AssistantError ? (error.context ?? {}) : {},
        };
      }
    },
  };
}

export const desktop_list_directory = defineDesktopTool(listDescriptor, (args) => ({
  tool: "list_directory",
  path: String(args.path ?? ""),
}));

export const desktop_read_file = defineDesktopTool(readDescriptor, (args) => ({
  tool: "read_file",
  path: String(args.path),
}));

export const desktop_search_files = defineDesktopTool(searchDescriptor, (args) => ({
  tool: "search_files",
  query: String(args.query),
  path: String(args.path ?? ""),
  contents: args.contents === true,
}));

export const desktop_write_file = defineDesktopTool(writeDescriptor, (args) => ({
  tool: "write_file",
  path: String(args.path),
  content: String(args.content ?? ""),
  overwrite: args.overwrite === true,
}));

export const DESKTOP_FUNCTION_TOOLS = [
  desktop_list_directory,
  desktop_read_file,
  desktop_search_files,
  desktop_write_file,
];
