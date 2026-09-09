import { describe, expect, it } from "vitest";

import { projectChatRequestSettings } from "./chat-request-settings.js";

describe("chat request settings", () => {
  it("excludes obsolete persisted settings from strict completion requests", () => {
    const persistedSettings = {
      temperature: 0.7,
      use_rag: false,
      rag_options: { topK: 3, namespace: "" },
    };

    expect(projectChatRequestSettings(persistedSettings).generationSettings).toEqual({
      temperature: 0.7,
    });
  });

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
