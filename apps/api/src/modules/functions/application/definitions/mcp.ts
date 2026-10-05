import { nativeMcpCallSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const mcp: FunctionToolDescriptor = {
  name: "mcp",
  description:
    "List the reviewed tools in selected MCP servers by omitting operation. To execute, provide the exact serverId, operation, schemaDigest and schema-valid params from that catalogue. Writes require approval of the exact action. Never retry an action with an unknown outcome.",
  type: "premium",
  permissions: ["network", "read"],
  maxIdenticalCalls: 1,
  inputSchema: nativeMcpCallSchema.partial({ serverId: true, operation: true, schemaDigest: true }),
};
