import { executeMcpTool } from "~/modules/mcp/application/tool-execution";
import type { ApiToolDefinition } from "~/types/functions";

import { mcp as descriptor } from "./definitions/mcp";

export const mcp: ApiToolDefinition = { ...descriptor, execute: executeMcpTool };
