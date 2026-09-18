import { describe, expect, it } from "vitest";

import { formatAssistantMessage } from "~/services/chat/messages/assistant-format";

const IMPACT = {
  inferenceTime: { total: 1380, unit: "ms" },
  energy: { total: 526, unit: "Wms" },
  emissions: { total: 47, unit: "ugCO2e" },
};

describe("formatAssistantMessage", () => {
  it("carries provider impact on the message usage", () => {
    const message = formatAssistantMessage({
      content: "Hello",
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      impact: IMPACT,
    });

    expect(message.usage).toMatchObject({ total_tokens: 14, impact: IMPACT });
  });

  it("omits impact when the provider did not report it", () => {
    const message = formatAssistantMessage({
      content: "Hello",
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });

    expect(message.usage).not.toHaveProperty("impact");
  });
});
