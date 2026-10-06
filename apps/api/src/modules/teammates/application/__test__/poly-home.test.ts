import { POLY_TEAMMATE_ID, type TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { ResolvedTeammateInvocation } from "../execution";
import { requirePolyHomeRun } from "../poly-home";

const polyContext: TeammateContext = {
  id: "teammate_context_poly",
  teammateId: POLY_TEAMMATE_ID,
  actorUserId: 7,
  scope: { type: "personal", id: "7" },
  homeConversationId: "teammate_home_poly",
  memoryDocumentId: "memory_poly",
  status: "active",
  createdAt: "2026-10-05T09:00:00.000Z",
  updatedAt: null,
};

function resolution(
  overrides: Partial<ResolvedTeammateInvocation> = {},
  context: TeammateContext | null = polyContext,
): ResolvedTeammateInvocation {
  return {
    invocation: { source: "conversation", conversationId: "teammate_home_poly" },
    actorUserId: 7,
    teammateId: POLY_TEAMMATE_ID,
    context,
    behaviour: "colleague",
    projectId: null,
    ...overrides,
  };
}

describe("requirePolyHomeRun", () => {
  it("allows Poly in the person's own Poly thread, from the app or a bound channel", () => {
    expect(() => requirePolyHomeRun(resolution(), "teammate_home_poly")).not.toThrow();
    expect(() =>
      requirePolyHomeRun(
        resolution({
          invocation: {
            source: "channel",
            bindingId: "binding_telegram",
            messageId: "message_1",
            senderMappingId: "sender_1",
            senderRevision: 1,
          },
        }),
        "teammate_home_poly",
      ),
    ).not.toThrow();
  });

  it("keeps Poly out of every other conversation and invocation", () => {
    expect(() => requirePolyHomeRun(resolution(), "chat_elsewhere")).toThrow(
      "Poly only works in its own conversation",
    );
    expect(() =>
      requirePolyHomeRun(
        resolution({ invocation: { source: "delegation", delegationId: "delegation_1" } }),
        "teammate_home_poly",
      ),
    ).toThrow();
    expect(() =>
      requirePolyHomeRun(
        resolution({}, { ...polyContext, scope: { type: "project", id: "project_1" } }),
        "teammate_home_poly",
      ),
    ).toThrow();
    expect(() =>
      requirePolyHomeRun(
        resolution({}, { ...polyContext, status: "paused" }),
        "teammate_home_poly",
      ),
    ).toThrow();
    expect(() => requirePolyHomeRun(undefined, "teammate_home_poly")).toThrow();
  });
});
