import { runNativeIntegrationGateway } from "~/modules/integrations/application/gateway";
import type { ApiToolDefinition } from "~/types/functions";

import { use_mcp_integration as descriptor } from "./definitions/use_mcp_integration";

export const use_mcp_integration: ApiToolDefinition = {
  ...descriptor,
  execute: runNativeIntegrationGateway,
};
