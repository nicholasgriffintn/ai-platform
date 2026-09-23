import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  collectCapabilityItems,
  createUnknownCapabilityDiscoveryResult,
  discoverAssistantCapabilities,
  filterCapabilityItems,
} from "~/modules/assistant-capabilities/application/discovery";
import { createCapabilityDiscoveryResponse } from "~/modules/assistant-capabilities/application/discovery-response";
import { loadCapabilityDiscoverySources } from "~/modules/assistant-capabilities/application/discovery-sources";
import { rankCapabilitiesSemantically } from "~/modules/assistant-capabilities/application/semantic-ranking";
import type { ApiToolDefinition } from "~/types/functions";

import { discover_capabilities as discover_capabilitiesDescriptor } from "./definitions/discover_capabilities";

export const discover_capabilities: ApiToolDefinition = {
  ...discover_capabilitiesDescriptor,
  execute: async (args, toolContext) => {
    let result;

    try {
      const sources = await loadCapabilityDiscoverySources(toolContext.request);
      const relevance = await rankCapabilitiesSemantically({
        env: toolContext.request.env,
        user: toolContext.request.user,
        query: args.query,
        items: filterCapabilityItems(collectCapabilityItems(sources), args),
        completionId: toolContext.completionId,
      });

      result = discoverAssistantCapabilities(sources, args, new Date(), relevance);
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
