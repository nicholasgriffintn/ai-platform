import {
  createUnknownCapabilityDiscoveryResult,
  discoverAssistantCapabilities,
} from "~/services/assistant-capability-discovery";
import { createCapabilityDiscoveryResponse } from "~/services/assistant-capability-discovery-response";
import { loadCapabilityDiscoverySources } from "~/services/assistant-capability-discovery-sources";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { discover_capabilities as discover_capabilitiesDescriptor } from "./definitions/discover_capabilities";

export const discover_capabilities: ApiToolDefinition = {
  ...discover_capabilitiesDescriptor,
  execute: async (args, toolContext) => {
    let result;

    try {
      const sources = await loadCapabilityDiscoverySources(toolContext.request);

      result = discoverAssistantCapabilities(sources, args);
    } catch (error) {
      if (
        error instanceof AssistantError &&
        [
          ErrorType.AUTHENTICATION_ERROR,
          ErrorType.AUTHORISATION_ERROR,
          ErrorType.FORBIDDEN,
          ErrorType.NOT_FOUND,
          ErrorType.UNAUTHORIZED,
        ].includes(error.type)
      ) {
        throw error;
      }

      result = createUnknownCapabilityDiscoveryResult(args.query);
    }

    return createCapabilityDiscoveryResponse(result);
  },
};
