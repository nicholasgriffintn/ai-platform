import { describe, expect, it } from "vitest";

import {
  createAppAssistantActionLaunch,
  createConnectorAssistantActionLaunch,
  readRecipeConversationLaunchIntent,
} from "../assistant-action-launch.js";

describe("assistant action launch URL contract", () => {
  it("reads only valid compact recipe actions", () => {
    expect(readRecipeConversationLaunchIntent("action=setup&recipe=morning-briefing")).toEqual({
      action: "setup",
      recipeId: "morning-briefing",
    });
    expect(readRecipeConversationLaunchIntent("action=delete&recipe=morning-briefing")).toBe(
      undefined,
    );
  });

  it("rejects unsafe catalogue navigation and connector URLs", () => {
    expect(() =>
      createAppAssistantActionLaunch({
        appId: "unsafe",
        appKind: "frontend",
        href: "javascript:alert(1)",
      }),
    ).toThrow("unsafe");
    expect(() =>
      createConnectorAssistantActionLaunch({
        provider: "gmail",
        authType: "composio",
        authorizationUrl: "data:text/html,unsafe",
      }),
    ).toThrow("unsafe");
  });
});
