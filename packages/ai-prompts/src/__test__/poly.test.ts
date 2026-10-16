import { describe, expect, it } from "vitest";

import { buildStandardChatPrompt } from "../index.js";

const base = {
  assistantName: "Polychat",
  assistantDescription: "A helpful assistant",
  model: { modelId: "test-model" },
  supportsToolCalls: true,
  memoryPolicy: { enabled: true, canRetrieve: true, canStore: true },
  persona: { name: "Poly", instructions: "You are Poly, the person's own assistant." },
  userContext: { date: "2026-10-05" },
};

describe("Poly in the standard prompt", () => {
  it("keeps Poly's behaviour in the system prompt and leaves per-turn context out", () => {
    const prompt = buildStandardChatPrompt({ ...base, poly: true });

    expect(prompt).toContain("You are Poly, the person's own assistant.");
    expect(prompt).toContain("This is the person's one continuous conversation with you.");
    expect(prompt).toContain("Call get_current_time");
    expect(prompt).not.toContain("<ui_context>");
    expect(prompt).not.toContain("<agenda>");
  });

  it("leaves ordinary chats without the Poly section", () => {
    expect(buildStandardChatPrompt(base)).not.toContain("<poly>");
  });
});
