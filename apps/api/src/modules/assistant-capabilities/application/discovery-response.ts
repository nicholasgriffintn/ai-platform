import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  ToolResponseType,
  type CapabilityDiscoveryItem,
  type CapabilityDiscoveryResult,
} from "@ngriffin_uk/polychat-schemas";

import type { IFunctionResponse } from "~/types";

const STATE_LABELS: Record<CapabilityDiscoveryItem["state"], string> = {
  ready: "Ready",
  setup_required: "Setup required",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

function formatCapability(item: CapabilityDiscoveryItem): string {
  const nextStep = item.invocation.availableNow ? ` Next: ${item.invocation.instruction}` : "";

  return `- ${item.name} (${STATE_LABELS[item.state]}) — ${item.reason}${nextStep}`;
}

export const DISCOVERY_READY_NEXT =
  "Follow a ready capability's exact Next instruction now; do not invent another tool name.";
export const DISCOVERY_UNAVAILABLE_NEXT =
  "Explain the supplied reason to the user; do not invent another tool name.";
export const DISCOVERY_SETUP_NEXT =
  "Wait for the user to complete a setup action shown here, then retry; do not invent another tool name.";
export const DISCOVERY_UNKNOWN_NEXT =
  "Ask the user to retry the request; do not infer availability or invent a tool name.";
export const DISCOVERY_NO_MATCH_NEXT =
  "Explain that no matching capability was found; do not invent a tool name.";

function createModelInstructions(
  result: CapabilityDiscoveryResult,
  requiresSetup: boolean,
): { content: string; next: string } {
  if (result.items.length === 0) {
    if (result.readiness?.state === "unknown") {
      return { content: result.readiness.reason, next: DISCOVERY_UNKNOWN_NEXT };
    }

    return {
      content: `No capabilities matched “${result.query}”.`,
      next: DISCOVERY_NO_MATCH_NEXT,
    };
  }

  const readyCount = result.items.filter((item) => item.invocation.availableNow).length;
  const matchLabel = result.items.length === 1 ? "capability" : "capabilities";
  const heading = requiresSetup
    ? `Found ${result.items.length} matching ${matchLabel} for “${result.query}”, but none are ready yet.`
    : `Found ${result.items.length} matching ${matchLabel} for “${result.query}”; ${readyCount} ${readyCount === 1 ? "is" : "are"} ready.`;

  return {
    content: [heading, "", ...result.items.map(formatCapability)].join("\n"),
    next: requiresSetup
      ? DISCOVERY_SETUP_NEXT
      : readyCount > 0
        ? DISCOVERY_READY_NEXT
        : DISCOVERY_UNAVAILABLE_NEXT,
  };
}

export function createCapabilityDiscoveryResponse(
  result: CapabilityDiscoveryResult,
): IFunctionResponse {
  const hasReadyCapability = result.items.some((item) => item.invocation.availableNow);
  const requiresSetup =
    !hasReadyCapability && result.items.some((item) => item.state === "setup_required");
  const needsUserAction = requiresSetup || result.readiness?.state === "unknown";

  const instructions = createModelInstructions(result, needsUserAction);

  return {
    name: CAPABILITY_DISCOVERY_TOOL_NAME,
    status: needsUserAction ? "pending" : "success",
    content: instructions.content,
    next: instructions.next,
    data: {
      formattedName: "Capability discovery",
      renderer: "capability_discovery",
      icon: "sparkles",
      responseType: needsUserAction ? ToolResponseType.CUSTOM : ToolResponseType.HIDDEN,
      [CAPABILITY_DISCOVERY_DATA_KEY]: result,
    },
  };
}
