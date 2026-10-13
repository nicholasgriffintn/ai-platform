import { POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ActivityRecord } from "~/modules/activity/infrastructure/ActivityRepository";

import { disagreeWithPolyHandoff } from "../handoff-disagreement";

const ensureContext = vi.hoisted(() => vi.fn());

vi.mock("~/modules/teammates/application/contexts", () => ({
  ensureActiveTeammateContext: ensureContext,
}));

function handoffRecord(
  overrides: Partial<ActivityRecord> = {},
  decision = "noted",
): ActivityRecord {
  return {
    id: "poly_handoff_1",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: "teammate_home_poly",
    capability_id: "poly.handoffs",
    group_id: "routine:occurrence_1:result",
    kind: "routine",
    status: "succeeded",
    summary: "Inbox sweep",
    data: JSON.stringify({
      sourceKind: "routine",
      sourceId: "installation_inbox",
      resultConversationId: "recipe_occurrence_1",
      urgency: "normal",
      decision,
      reason: "not_urgent",
      summary: "",
      receipt: null,
    }),
    created_at: "2026-10-10T09:00:00.000Z",
    updated_at: "2026-10-10T09:00:00.000Z",
    ...overrides,
  };
}

function setup(record: ActivityRecord | null, existing: { id: string }[] = []) {
  const corrections = {
    listActiveByPlacementRefs: vi.fn(async () => existing),
    create: vi.fn(async () => undefined),
    recordRecurrence: vi.fn(async () => undefined),
  };
  const context = {
    requireUser: () => ({ id: 7 }),
    repositories: {
      activities: { getActivityById: async () => record },
      corrections,
    },
  } as unknown as ServiceContext;

  return { context, corrections };
}

describe("disagreeWithPolyHandoff", () => {
  beforeEach(() =>
    ensureContext.mockResolvedValue({
      id: "teammate_context_poly",
      teammateId: POLY_TEAMMATE_ID,
      homeConversationId: "teammate_home_poly",
    }),
  );

  it("records a rule that this routine's results always reach the person", async () => {
    const { context, corrections } = setup(handoffRecord());

    await expect(disagreeWithPolyHandoff(context, "poly_handoff_1")).resolves.toMatchObject({
      result_conversation_id: "recipe_occurrence_1",
    });
    expect(corrections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        placement: "policy",
        placementRef: "poly.handoff_urgency:installation_inbox",
      }),
    );
  });

  it("counts a second disagreement about the same routine instead of adding a rule", async () => {
    const { context, corrections } = setup(handoffRecord(), [{ id: "correction_1" }]);

    await expect(disagreeWithPolyHandoff(context, "poly_handoff_1")).resolves.toMatchObject({
      correction_id: "correction_1",
    });
    expect(corrections.create).not.toHaveBeenCalled();
    expect(corrections.recordRecurrence).toHaveBeenCalledTimes(1);
  });

  it("refuses a handoff from someone else's thread or one Poly already raised", async () => {
    await expect(
      disagreeWithPolyHandoff(
        setup(handoffRecord({ conversation_id: "someone_elses_poly" })).context,
        "poly_handoff_1",
      ),
    ).rejects.toThrow("not in your Poly thread");
    await expect(
      disagreeWithPolyHandoff(setup(handoffRecord({}, "notified")).context, "poly_handoff_1"),
    ).rejects.toThrow("already told you");
  });
});
