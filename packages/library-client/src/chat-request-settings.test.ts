import { describe, expect, it } from "vitest";

import { projectChatRequestSettings } from "./chat-request-settings";

describe("chat request settings", () => {
  it("sends an explicitly selected processing tier with generation settings", () => {
    expect(
      projectChatRequestSettings({
        enabled_tools: ["web_search"],
        localOnly: false,
        service_tier: "fast",
      }),
    ).toEqual({
      enabledTools: ["web_search"],
      generationSettings: { service_tier: "fast" },
      hostedToolOptions: undefined,
    });
  });
});
