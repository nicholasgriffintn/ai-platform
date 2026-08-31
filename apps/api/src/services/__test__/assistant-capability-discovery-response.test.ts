import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  ResponseDisplayType,
  type CapabilityDiscoveryResult,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { createCapabilityDiscoveryResponse } from "../assistant-capability-discovery-response";

function resultWithItem(
  item: CapabilityDiscoveryResult["items"][number],
): CapabilityDiscoveryResult {
  return {
    query: "set a reminder",
    items: [item],
    total: 1,
  };
}

describe("createCapabilityDiscoveryResponse", () => {
  it("returns useful fallback copy when the matching capability needs setup", () => {
    const result = resultWithItem({
      id: "connector:todoist",
      kind: "connector",
      name: "Todoist",
      description: "Create tasks and reminders.",
      configured: false,
      state: "setup_required",
      reason: "Todoist needs to be connected before it can be used.",
      tags: ["connector"],
      invocation: {
        toolName: "use_recipe_connector",
        availableNow: false,
        instruction:
          'Wait for the user to connect Todoist. Then call use_recipe_connector with provider "todoist" and a useCase.',
      },
      setup: { kind: "connector", provider: "todoist" },
    });

    const response = createCapabilityDiscoveryResponse(result);

    expect(response).toMatchObject({
      status: "pending",
      data: {
        responseType: ResponseDisplayType.CUSTOM,
        [CAPABILITY_DISCOVERY_DATA_KEY]: result,
      },
    });
    expect(response.content).toContain("Todoist");
    expect(response.content).toContain("needs to be connected");
    expect(response.content).not.toMatch(/^\s*\{/);
  });

  it("keeps the exact invocation instruction when a capability is ready", () => {
    const result = resultWithItem({
      id: "tool:create_scheduled_task",
      kind: "tool",
      name: "Create scheduled task",
      description: "Schedule a task for later.",
      configured: true,
      state: "ready",
      reason: "This tool is enabled and ready to use.",
      tags: ["tool"],
      invocation: {
        toolName: "create_scheduled_task",
        availableNow: true,
        instruction: "Call create_scheduled_task using its declared parameter schema.",
      },
    });

    const response = createCapabilityDiscoveryResponse(result);

    expect(response).toMatchObject({
      status: "success",
      data: { responseType: ResponseDisplayType.HIDDEN },
    });
    expect(response.content).toContain(
      "Call create_scheduled_task using its declared parameter schema.",
    );
  });
});
