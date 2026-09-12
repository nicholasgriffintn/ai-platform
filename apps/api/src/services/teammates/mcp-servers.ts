import {
  mcpServerSchema,
  mcpToolConfigurationSchema,
  normaliseMcpServerLabel,
  type McpToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

function uniqueServerLabel(base: string, index: number, used: Set<string>): string {
  let label = base || `server_${index + 1}`;
  let suffix = index + 1;

  while (used.has(label)) {
    label = `${base.slice(0, 70)}_${suffix}`;
    suffix += 1;
  }

  used.add(label);

  return label;
}

export function resolveTeammateMcpServers(value: unknown): McpToolConfiguration["servers"] {
  const stored = typeof value === "string" ? safeParseJson<unknown>(value) : value;

  if (stored === null || stored === undefined) {
    return [];
  }

  const parsed = mcpServerSchema.array().safeParse(stored);

  if (!parsed.success) {
    throw new AssistantError(
      "The teammate has an invalid MCP server configuration",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const usedLabels = new Set<string>();
  const servers = parsed.data.map((server, index) => {
    if (server.type === "stdio" || server.command || server.args?.length) {
      throw new AssistantError(
        "Hosted teammates support HTTPS MCP servers only",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const url = new URL(server.url);
    const label = uniqueServerLabel(
      normaliseMcpServerLabel(server.label ?? url.hostname),
      index,
      usedLabels,
    );

    return { label, url: url.toString() };
  });

  if (servers.length === 0) {
    return [];
  }

  const configuration = mcpToolConfigurationSchema.safeParse({ servers });

  if (!configuration.success) {
    throw new AssistantError(
      "Teammate MCP servers must use HTTPS URLs without embedded credentials",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return configuration.data.servers;
}
