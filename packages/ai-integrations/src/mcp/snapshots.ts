import {
  integrationSnapshotSchema,
  integrationToolSchema,
  type IntegrationSnapshot,
  type IntegrationTool,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

export async function createIntegrationSnapshot(params: {
  endpoint: string;
  authentication: IntegrationSnapshot["authentication"];
  tools: readonly unknown[];
}): Promise<IntegrationSnapshot> {
  const tools = params.tools.map((tool) => integrationToolSchema.parse(tool));

  if (new Set(tools.map((tool) => tool.name)).size !== tools.length) {
    throw new Error("The MCP server returned duplicate tool names");
  }

  tools.sort((left, right) => left.name.localeCompare(right.name));
  const digest = await sha256Hex(
    canonicalJson({
      endpoint: params.endpoint,
      authentication: params.authentication,
      tools: tools.map((tool) => ({
        name: tool.name,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      })),
    }),
  );

  return integrationSnapshotSchema.parse({ ...params, tools, digest });
}

export function getGrantedIntegrationTools(
  snapshot: IntegrationSnapshot,
  operations: readonly string[],
): IntegrationTool[] {
  const granted = new Set(operations);

  return snapshot.tools.filter((tool) => granted.has(tool.name));
}
