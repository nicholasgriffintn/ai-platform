import { describe, expect, it, vi } from "vitest";

vi.mock("~/infrastructure/ai", () => ({ ai: {} }));

import { resolveToolIntentRequest } from "~/modules/chat/application/tools/tool-intent";
import type { Message } from "~/types";

describe("resolveToolIntentRequest", () => {
  it("judges an approval reply against the original user request", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: "Build me a snake game", timestamp: 1 },
      { id: "assistant-1", role: "assistant", content: "On it", timestamp: 2 },
      {
        id: "user-2",
        role: "user",
        content: "Approve: store memory?",
        timestamp: 3,
        data: { toolInteraction: { toolName: "store_memory", response: {} } },
      },
    ];

    expect(resolveToolIntentRequest(messages, "Approve: store memory?")).toBe(
      "Build me a snake game",
    );
  });
});
