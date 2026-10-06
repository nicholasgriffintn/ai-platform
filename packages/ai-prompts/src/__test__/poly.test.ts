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
  it("keeps the standard sections and adds Poly's behaviour and escaped ui context", () => {
    const prompt = buildStandardChatPrompt({
      ...base,
      poly: {
        uiContext: { place: "attention", conversationId: "<conversation-1>" },
      },
    });

    expect(prompt).toContain("You are Poly, the person's own assistant.");
    expect(prompt).toContain("This is the person's one continuous conversation with you.");
    expect(prompt).toContain("<place>Attention</place>");
    expect(prompt).toContain("&lt;conversation-1&gt;");
    expect(prompt).not.toContain("<conversation-1>");
    expect(prompt).toContain("2026-10-05");
  });

  it("lists the agenda as escaped data and leaves it out when there is nothing on it", () => {
    const withAgenda = buildStandardChatPrompt({
      ...base,
      poly: {
        agenda: {
          needsYou: ["delegation: Book <venue> (awaiting approval)"],
          workingOn: [],
          done: ["goal: Ship notes (completed)"],
          noted: ["routine: Inbox sweep (not urgent)"],
        },
      },
    });
    const empty = buildStandardChatPrompt({
      ...base,
      poly: { agenda: { needsYou: [], workingOn: [], done: [], noted: [] } },
    });

    expect(withAgenda).toContain(
      "<needs_you>\n- delegation: Book &lt;venue&gt; (awaiting approval)",
    );
    expect(withAgenda).toContain("<done_this_week>");
    expect(withAgenda).toContain("<noted_quietly>\n- routine: Inbox sweep (not urgent)");
    expect(withAgenda).not.toContain("<working_on>");
    expect(empty).not.toContain("<agenda>");
  });

  it("leaves ordinary chats without the Poly section", () => {
    expect(buildStandardChatPrompt(base)).not.toContain("<poly>");
  });
});
