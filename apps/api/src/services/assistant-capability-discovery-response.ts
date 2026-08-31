import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  ResponseDisplayType,
  type CapabilityDiscoveryItem,
  type CapabilityDiscoveryResult,
} from "@ngriffin_uk/polychat-schemas";

import type { IFunctionResponse } from "~/types";

const STATE_LABELS: Record<CapabilityDiscoveryItem["state"], string> = {
  ready: "Ready",
  setup_required: "Setup required",
  unavailable: "Unavailable",
};

function formatCapability(item: CapabilityDiscoveryItem): string {
  const nextStep = item.invocation.availableNow ? ` Next: ${item.invocation.instruction}` : "";

  return `- ${item.name} (${STATE_LABELS[item.state]}) — ${item.reason}${nextStep}`;
}

function createModelInstructions(
  result: CapabilityDiscoveryResult,
  requiresSetup: boolean,
): string {
  if (result.items.length === 0) {
    return `No capabilities matched “${result.query}”. Explain that no matching capability was found and do not invent a tool name.`;
  }

  const readyCount = result.items.filter((item) => item.invocation.availableNow).length;
  const matchLabel = result.items.length === 1 ? "capability" : "capabilities";
  const heading = requiresSetup
    ? `Found ${result.items.length} matching ${matchLabel} for “${result.query}”, but none are ready yet.`
    : `Found ${result.items.length} matching ${matchLabel} for “${result.query}”; ${readyCount} ${readyCount === 1 ? "is" : "are"} ready.`;
  const instruction = requiresSetup
    ? "Complete one of the setup actions shown here, then retry the request. Until then, wait for the user and do not invent another tool name."
    : "Continue now with a ready capability by following its exact Next instruction. If none are ready, explain the supplied reason. Do not invent another tool name.";

  return [heading, instruction, "", ...result.items.map(formatCapability)].join("\n");
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
