import { META_TOOL_NAMES } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { AssistantError } from "~/utils/errors";

import {
  filterToolsForConversationType,
  getMetaAssistantToolNames,
  resolveMetaAssistantScope,
} from "../meta-assistant";

const tools = [
  { name: "web_search" },
  { name: "store_memory" },
  ...META_TOOL_NAMES.map((name) => ({ name })),
];

function repositories(stored: Record<string, unknown> | null) {
  return {
    conversations: {
      getConversation: async () => stored,
    },
  } as never;
}

function options(overrides: Record<string, unknown>) {
  return {
    completion_id: "conversation-1",
    context: { user: { id: 7, plan_id: "pro" } },
    ...overrides,
  } as never;
}

describe("filterToolsForConversationType", () => {
  it("gives the meta scope only the meta tools", () => {
    expect(filterToolsForConversationType(tools, "meta").map((tool) => tool.name)).toEqual(
      getMetaAssistantToolNames(),
    );
  });

  it("never exposes meta tools to chat or task conversations", () => {
    for (const type of ["chat", "task", undefined] as const) {
      const names = filterToolsForConversationType(tools, type).map((tool) => tool.name);

      expect(names).toEqual(["web_search", "store_memory"]);
    }
  });
});

describe("resolveMetaAssistantScope", () => {
  it("is null for ordinary conversations", async () => {
    await expect(
      resolveMetaAssistantScope(options({}), repositories({ type: "chat", user_id: 7 })),
    ).resolves.toBeNull();
  });

  it("resumes a stored meta conversation without the request marker", async () => {
    await expect(
      resolveMetaAssistantScope(options({}), repositories({ type: "meta", user_id: 7 })),
    ).resolves.toEqual({ uiContext: undefined });
  });

  it("carries the client ui context for a new meta conversation", async () => {
    await expect(
      resolveMetaAssistantScope(
        options({ meta_assistant: { ui_context: { place: "work", projectId: "p1" } } }),
        repositories(null),
      ),
    ).resolves.toEqual({ uiContext: { place: "work", projectId: "p1" } });
  });

  it("refuses the marker on a conversation that is not meta", async () => {
    await expect(
      resolveMetaAssistantScope(
        options({ meta_assistant: {} }),
        repositories({ type: "chat", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("refuses another user's meta conversation and anonymous callers", async () => {
    await expect(
      resolveMetaAssistantScope(options({}), repositories({ type: "meta", user_id: 9 })),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      resolveMetaAssistantScope(
        options({ meta_assistant: {}, context: { user: undefined } }),
        repositories(null),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });
});
