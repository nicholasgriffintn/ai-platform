import { POLY_NAVIGATION_TOOL_NAMES, POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it } from "vitest";

import { filterToolsForPolyTurn, resolvePolyScope } from "~/modules/chat/application/policy/poly";

const tools = [
  { name: "web_search" },
  { name: "store_memory" },
  ...POLY_NAVIGATION_TOOL_NAMES.map((name) => ({ name })),
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
    resolved_configuration: { teammateId: POLY_TEAMMATE_ID },
    ...overrides,
  } as never;
}

describe("filterToolsForPolyTurn", () => {
  it("offers navigation only on turns the person started in their Poly thread", () => {
    const userTurn = filterToolsForPolyTurn(tools, { conversationType: "poly", trigger: "user" });
    const wake = filterToolsForPolyTurn(tools, { conversationType: "poly", trigger: "schedule" });

    expect(userTurn.map((tool) => tool.name)).toEqual(tools.map((tool) => tool.name));
    expect(wake.map((tool) => tool.name)).toEqual(["web_search", "store_memory"]);
  });

  it("never offers navigation outside a Poly thread", () => {
    for (const conversationType of ["chat", "task", "delegate", undefined] as const) {
      const names = filterToolsForPolyTurn(tools, { conversationType, trigger: "user" }).map(
        (tool) => tool.name,
      );

      expect(names).toEqual(["web_search", "store_memory"]);
    }
  });
});

describe("resolvePolyScope", () => {
  it("is null for ordinary conversations", async () => {
    await expect(
      resolvePolyScope(options({}), repositories({ type: "chat", user_id: 7 })),
    ).resolves.toBeNull();
  });

  it("resumes the person's Poly thread and carries their ui context", async () => {
    await expect(
      resolvePolyScope(
        options({ poly: { ui_context: { place: "attention" } } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).resolves.toEqual({ uiContext: { place: "attention" }, navigation: true });
  });

  it("withholds navigation from turns the person did not start", async () => {
    await expect(
      resolvePolyScope(
        options({ trigger: "delegation" }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).resolves.toEqual({ uiContext: undefined, navigation: false });
  });

  it("refuses to start a Poly thread from a chat request", async () => {
    await expect(
      resolvePolyScope(options({ poly: {} }), repositories(null)),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      resolvePolyScope(options({ poly: {} }), repositories({ type: "chat", user_id: 7 })),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("refuses a Poly thread run as anything other than Poly", async () => {
    await expect(
      resolvePolyScope(
        options({ resolved_configuration: { teammateId: "platform-research" } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      resolvePolyScope(
        options({ resolved_configuration: undefined }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("refuses another person's Poly thread and anonymous callers", async () => {
    await expect(
      resolvePolyScope(options({}), repositories({ type: "poly", user_id: 9 })),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      resolvePolyScope(
        options({ context: { user: undefined } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });
});
