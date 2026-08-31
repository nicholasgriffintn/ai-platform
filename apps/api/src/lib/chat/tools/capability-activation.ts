import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  capabilityDiscoveryResultSchema,
  RESPONSE_TOOL_ACTIVATION_DATA_KEY,
  responseToolActivationSchema,
  SKILL_LOAD_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";

import { expandFunctionToolNames } from "~/services/functions";
import type { Message } from "~/types";

/**
 * Only these tools may widen the turn's tool set. Anything else could be relaying data from an
 * external service, and a tool result is not a place to accept instructions from one.
 */
const ACTIVATING_TOOL_NAMES = new Set<string>([
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
]);

function collectDiscoveredToolNames(
  result: Pick<Message, "data" | "name">,
  toolNames: Set<string>,
): void {
  const parsed = capabilityDiscoveryResultSchema.safeParse(
    result.data?.[CAPABILITY_DISCOVERY_DATA_KEY],
  );

  if (!parsed.success) {
    return;
  }

  for (const item of parsed.data.items) {
    if (item.state === "ready" && item.invocation.availableNow && item.invocation.autoActivate) {
      toolNames.add(item.invocation.toolName);
    }
  }
}

export function getResponseScopedCapabilityToolNames(
  results: readonly Pick<Message, "data" | "name" | "status">[],
): string[] {
  const toolNames = new Set<string>();

  for (const result of results) {
    if (result.status !== "success" || !ACTIVATING_TOOL_NAMES.has(result.name ?? "")) {
      continue;
    }

    collectDiscoveredToolNames(result, toolNames);

    const activated = responseToolActivationSchema.safeParse(
      result.data?.[RESPONSE_TOOL_ACTIVATION_DATA_KEY],
    );

    if (activated.success) {
      for (const toolName of activated.data) {
        toolNames.add(toolName);
      }
    }
  }

  return expandFunctionToolNames([...toolNames]);
}
