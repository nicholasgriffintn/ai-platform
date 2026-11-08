import { POLY_TEAMMATE_ID, type TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { ResolvedTeammateInvocation } from "../execution";
import { admitTeammateContextAuthority, requirePolyHomeRun } from "../poly-home";

const polyContext: TeammateContext = {
  id: "teammate_context_poly",
  teammateId: POLY_TEAMMATE_ID,
  actorUserId: 7,
  scope: { type: "personal", id: "7" },
  homeConversationId: "teammate_home_poly",
  memoryDocumentId: "memory_poly",
  status: "active",
  autonomyLevel: "assistant",
  standingApprovals: [],
  approvalStreaks: [],
  pausedUntil: null,
  ownerSeenAt: "2026-10-06T09:00:00.000Z",
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
  it("runs Poly's own routines in their occurrence conversation", () => {
    const invocation = {
      source: "routine" as const,
      installationId: "installation_1",
      occurrenceId: "occurrence_1",
    };

    expect(() =>
      requirePolyHomeRun(resolution({ invocation }), "recipe_occurrence_1"),
    ).not.toThrow();
    expect(() =>
      requirePolyHomeRun(
        resolution({ invocation }, { ...polyContext, scope: { type: "project", id: "project_1" } }),
        "recipe_occurrence_1",
      ),
    ).toThrow();
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

describe("admitTeammateContextAuthority with a ceiling", () => {
  const partner: TeammateContext = {
    ...polyContext,
    autonomyLevel: "partner",
    ownerSeenAt: "2026-10-17T09:00:00.000Z",
    standingApprovals: [
      {
        toolName: "create_note",
        destination: "notes",
        grantedAt: "2026-10-16T09:00:00.000Z",
        expiresAt: "2026-11-16T09:00:00.000Z",
      },
    ],
  };

  it("runs a read-only routine as an observer with no standing approvals or acting rules", () => {
    const authority = admitTeammateContextAuthority({
      context: partner,
      trigger: "schedule",
      ceiling: "observer",
      now: Date.parse("2026-10-17T10:00:00.000Z"),
    });

    expect(authority.autonomyLevel).toBe("observer");
    expect(authority.standingApprovals).toEqual([]);
    expect(authority.actingRulesSuspended).toBe(true);
  });
});
