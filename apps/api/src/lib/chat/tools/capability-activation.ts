import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  capabilityDiscoveryResultSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";

export function getResponseScopedCapabilityToolNames(
  results: readonly Pick<Message, "data" | "name" | "status">[],
): string[] {
  const toolNames = new Set<string>();

  for (const result of results) {
    if (result.name !== CAPABILITY_DISCOVERY_TOOL_NAME || result.status !== "success") {
      continue;
    }

    const parsed = capabilityDiscoveryResultSchema.safeParse(
      result.data?.[CAPABILITY_DISCOVERY_DATA_KEY],
    );

    if (!parsed.success) {
      continue;
    }

    for (const item of parsed.data.items) {
      if (
        item.kind === "tool" &&
        item.state === "ready" &&
        item.invocation.availableNow &&
        item.invocation.autoActivate
      ) {
        toolNames.add(item.invocation.toolName);
      }
    }
  }

  return [...toolNames];
}
