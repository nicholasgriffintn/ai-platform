import { POLY_NAVIGATION_TOOL_NAMES, POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it } from "vitest";

import { filterToolsForPolyTurn, isAdmittedPolyRun } from "~/modules/chat/application/policy/poly";

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

describe("isAdmittedPolyRun", () => {
  it("is false for ordinary conversations", async () => {
    await expect(
      isAdmittedPolyRun(options({}), repositories({ type: "chat", user_id: 7 })),
    ).resolves.toBe(false);
  });

  it("admits the person's Poly thread run as Poly", async () => {
    await expect(
      isAdmittedPolyRun(
        options({ poly: { ui_context: { place: "attention" } } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).resolves.toBe(true);
  });

  it("refuses to start a Poly thread from a chat request", async () => {
    await expect(
      isAdmittedPolyRun(options({ poly: {} }), repositories(null)),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      isAdmittedPolyRun(options({ poly: {} }), repositories({ type: "chat", user_id: 7 })),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("refuses a Poly thread run as anything other than Poly", async () => {
    await expect(
      isAdmittedPolyRun(
        options({ resolved_configuration: { teammateId: "platform-research" } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      isAdmittedPolyRun(
        options({ resolved_configuration: undefined }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("refuses another person's Poly thread and anonymous callers", async () => {
    await expect(
      isAdmittedPolyRun(options({}), repositories({ type: "poly", user_id: 9 })),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      isAdmittedPolyRun(
        options({ context: { user: undefined } }),
        repositories({ type: "poly", user_id: 7 }),
      ),
    ).rejects.toBeInstanceOf(AssistantError);
  });
});
