import { isComposioConnectorSessionHandle } from "@ngriffin_uk/polychat-ai-integrations";
import {
  integrationIdSchema,
  integrationOperationSchema,
  NATIVE_MCP_TOOL_NAME,
  recipeConnectorProviderSchema,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecordOrNull } from "@ngriffin_uk/polychat-utility-server/json";

import { resolveNativeMcpApprovalAuthority } from "~/modules/integrations/application/approval-authority";

import { getRecipeConnectorAdapter } from "./connector-adapters";
import type {
  ResolveConnectorApprovalAuthority,
  StoredConnectorOperationCall,
} from "./connector-approval-authority";

export interface ConnectorApprovalReplayAdapter {
  toolName: string;
  parseCall: (value: unknown) => StoredConnectorOperationCall | null;
  resolveAuthority: ResolveConnectorApprovalAuthority;
}

function parseStoredOperation(value: unknown): StoredConnectorOperationCall | null {
  const parsed = parseJsonRecordOrNull(value);

  if (
    !parsed ||
    typeof parsed.provider !== "string" ||
    !integrationOperationSchema.safeParse(parsed.operation).success ||
    (parsed.params !== undefined && !isRecord(parsed.params))
  ) {
    return null;
  }

  const operation = integrationOperationSchema.parse(parsed.operation);

  return {
    provider: parsed.provider,
    operation,
    ...(typeof parsed.sessionId === "string" ? { sessionId: parsed.sessionId } : {}),
    ...(isRecord(parsed.params) ? { params: parsed.params } : {}),
  };
}

export function getConnectorApprovalReplayAdapter(
  providerId: string,
): ConnectorApprovalReplayAdapter | undefined {
  if (integrationIdSchema.safeParse(providerId).success) {
    return {
      toolName: NATIVE_MCP_TOOL_NAME,
      resolveAuthority: resolveNativeMcpApprovalAuthority,
      parseCall: (value) => {
        const call = parseStoredOperation(value);
        const parsed = parseJsonRecordOrNull(value);

        return call && call.provider === providerId && parsed?.sessionId === undefined
          ? call
          : null;
      },
    };
  }

  const provider = recipeConnectorProviderSchema.safeParse(providerId);
  const adapter = provider.success ? getRecipeConnectorAdapter(provider.data) : undefined;

  if (!adapter?.approval) {
    return undefined;
  }

  return {
    toolName: "use_recipe_connector",
    resolveAuthority: adapter.approval.resolveAuthority,
    parseCall: (value) => {
      const call = parseStoredOperation(value);
      const parsed = parseJsonRecordOrNull(value);

      if (
        !call ||
        call.provider !== providerId ||
        (adapter.provider.auth.authType === "composio"
          ? !isComposioConnectorSessionHandle(parsed?.sessionId)
          : parsed?.sessionId !== undefined)
      ) {
        return null;
      }

      return call;
    },
  };
}
