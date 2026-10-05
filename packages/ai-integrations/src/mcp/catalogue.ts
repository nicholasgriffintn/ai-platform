import {
  nativeMcpToolSchema,
  type NativeMcpCatalogTool,
  type NativeMcpTool,
} from "@ngriffin_uk/polychat-schemas";
import { assertJsonComplexity, canonicalJson, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { createBoundedJsonSchemaValidator } from "@ngriffin_uk/polychat-utility-server/json";

import { McpProtocolError } from "./errors.js";
import { readMcpParameterHeaders } from "./headers.js";

export interface McpRejectedTool {
  name: string | null;
  reason: "unsupported_definition";
}

export interface McpDiscoveredCatalogue {
  tools: NativeMcpCatalogTool[];
  rejectedTools: McpRejectedTool[];
}

export async function getNativeMcpToolSchemaDigest(tool: NativeMcpTool): Promise<string> {
  const definition = nativeMcpToolSchema.parse(tool);

  assertJsonComplexity(definition);

  return sha256Hex(canonicalJson(definition));
}

export function validateNativeMcpTool(value: unknown): NativeMcpTool {
  const tool = nativeMcpToolSchema.parse(value);

  createBoundedJsonSchemaValidator(tool.inputSchema);
  readMcpParameterHeaders(tool.inputSchema);

  if (tool.outputSchema) {
    createBoundedJsonSchemaValidator(tool.outputSchema);
  }

  return tool;
}

export async function readDiscoveredMcpTools(
  values: unknown[],
  names: Set<string>,
  catalogue: McpDiscoveredCatalogue,
): Promise<void> {
  for (const value of values) {
    const definition = nativeMcpToolSchema.safeParse(value);

    if (definition.success) {
      if (names.has(definition.data.name)) {
        throw new McpProtocolError("invalid_response");
      }

      names.add(definition.data.name);
    }

    let tool: NativeMcpTool;

    try {
      tool = validateNativeMcpTool(value);
    } catch {
      catalogue.rejectedTools.push({
        name: definition.success ? definition.data.name : null,
        reason: "unsupported_definition",
      });
      continue;
    }

    catalogue.tools.push({
      ...tool,
      schemaDigest: await getNativeMcpToolSchemaDigest(tool),
      access: "disabled",
    });
  }
}
