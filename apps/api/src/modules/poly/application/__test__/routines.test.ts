import { POLY_HANDOFF_CAPABILITY_ID, type TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";

import { listPolyRoutineBriefs } from "../routines";

const polyContext = { homeConversationId: "teammate_home_poly" } as TeammateContext;

function handoff(id: string, groupId: string, summary: string, decision = "notified") {
  return {
    id,
    capability_id: POLY_HANDOFF_CAPABILITY_ID,
    group_id: groupId,
    summary: "Poly: Inbox triage",
    created_at: "2026-11-05T08:30:00.000Z",
    data: JSON.stringify({
      sourceKind: "routine",
      sourceId: "install_1",
      resultConversationId: "recipe_task_1",
      urgency: "high",
      decision,
      reason: "owner_must_act",
      summary,
      receipt: null,
    }),
  };
}

function context(records: unknown[]) {
  return {
    repositories: fakeRepositories([
      [ActivityRepository, { listConversationActivitiesSince: async () => records }],
    ]),
  } as unknown as ServiceContext;
}

describe("listPolyRoutineBriefs", () => {
  it("shows the latest state of each run, including briefs Poly kept quiet", async () => {
    const briefs = await listPolyRoutineBriefs(
      context([
        handoff("result", "routine:occurrence_1:result", "**Three** drafts saved."),
        handoff("attention", "routine:occurrence_1:attention", "Waiting on a draft."),
        handoff("quiet", "routine:occurrence_2:result", "Nothing new.", "noted"),
      ]),
      polyContext,
    );

    expect(briefs.map((brief) => brief.id)).toEqual(["result", "quiet"]);
    expect(briefs[0]).toMatchObject({
      summary: "Three drafts saved.",
      needs_you: false,
      conversation_id: "recipe_task_1",
    });
  });

  it("marks a run that is still waiting on the person", async () => {
    const [brief] = await listPolyRoutineBriefs(
      context([handoff("attention", "routine:occurrence_1:attention", "Waiting on a draft.")]),
      polyContext,
    );

    expect(brief?.needs_you).toBe(true);
  });
});
