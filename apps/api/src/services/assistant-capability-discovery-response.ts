import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  ResponseDisplayType,
  type CapabilityDiscoveryResult,
} from "@ngriffin_uk/polychat-schemas";

import type { IFunctionResponse } from "~/types";

function createModelInstructions(
  result: CapabilityDiscoveryResult,
  requiresSetup: boolean,
): string {
  return JSON.stringify({
    query: result.query,
    instruction: requiresSetup
      ? "Wait for the user to complete one of the supplied setup actions. Do not invent another tool name."
      : "Continue the task now when a capability has invocation.availableNow=true. Follow its invocation.toolName and invocation.instruction exactly. If none are available, explain the supplied reason. Do not invent another tool name.",
    capabilities: result.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      state: item.state,
      reason: item.reason,
      invocation: item.invocation,
    })),
  });
}

export function createCapabilityDiscoveryResponse(
  result: CapabilityDiscoveryResult,
): IFunctionResponse {
  const hasReadyCapability = result.items.some((item) => item.invocation.availableNow);
  const requiresSetup =
    !hasReadyCapability && result.items.some((item) => item.state === "setup_required");

  return {
    name: CAPABILITY_DISCOVERY_TOOL_NAME,
    status: requiresSetup ? "pending" : "success",
    content: createModelInstructions(result, requiresSetup),
    data: {
      formattedName: "Capability discovery",
      renderer: "capability_discovery",
      icon: "sparkles",
      responseType: requiresSetup ? ResponseDisplayType.CUSTOM : ResponseDisplayType.HIDDEN,
      [CAPABILITY_DISCOVERY_DATA_KEY]: result,
    },
  };
}
