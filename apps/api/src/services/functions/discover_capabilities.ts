import { discoverAssistantCapabilities } from "~/services/assistant-capability-discovery";
import { createCapabilityDiscoveryResponse } from "~/services/assistant-capability-discovery-response";
import { loadCapabilityDiscoverySources } from "~/services/assistant-capability-discovery-sources";
import type { ApiToolDefinition } from "~/types/functions";

import { discover_capabilities as discover_capabilitiesDescriptor } from "./definitions/discover_capabilities";

export const discover_capabilities: ApiToolDefinition = {
  ...discover_capabilitiesDescriptor,
  execute: async (args, toolContext) => {
    const sources = await loadCapabilityDiscoverySources(toolContext.request);
    const result = discoverAssistantCapabilities(sources, args);

    return createCapabilityDiscoveryResponse(result);
  },
};
