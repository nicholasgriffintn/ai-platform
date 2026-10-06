import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ActivityRecord } from "~/modules/activity/infrastructure/ActivityRepository";
import type { IUser } from "~/types";

import { admitRoutineHandoff, readPolyHandoff } from "../handoffs";

const judge = vi.hoisted(() => vi.fn());

vi.mock("../handoff-judgement", () => ({ judgeRoutineResult: judge }));

function notifiedRecord(index: number): ActivityRecord {
  return {
    id: `poly_handoff_earlier_${index}`,
    created_by_user_id: 7,
    project_id: null,
    conversation_id: "teammate_home_poly",
    capability_id: "poly.handoffs",
    group_id: `routine:earlier_${index}:result`,
    kind: "routine",
    status: "succeeded",
    summary: "Earlier routine",
    data: JSON.stringify({
      sourceKind: "routine",
      sourceId: "installation_inbox",
      resultConversationId: null,
      urgency: "high",
      decision: "notified",
      reason: "owner_must_act",
      summary: "",
      receipt: null,
    }),
    created_at: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function memoryActivities(notifiedToday: number) {
  const records = new Map<string, ActivityRecord>();
  const earlier = Array.from({ length: notifiedToday }, (_, index) => notifiedRecord(index));

  return {
    records,
    getActivityById: async (id: string) => records.get(id) ?? null,
    listConversationActivitiesSince: async () => [...earlier, ...records.values()],
    recordActivityOnce: async (input: {
      id: string;
      createdByUserId: number;
      conversationId: string;
      capabilityId: string;
      groupId: string;
      kind: string;
      status: ActivityRecord["status"];
      summary: string;
      data: Record<string, unknown>;
      createdAt: string;
    }) => {
      if (!records.has(input.id)) {
        records.set(input.id, {
          id: input.id,
          created_by_user_id: input.createdByUserId,
          project_id: null,
          conversation_id: input.conversationId,
          capability_id: input.capabilityId,
          group_id: input.groupId,
          kind: input.kind,
          status: input.status,
          summary: input.summary,
          data: JSON.stringify(input.data),
          created_at: input.createdAt,
          updated_at: input.createdAt,
        });
      }

      return records.get(input.id);
    },
  };
}

function input(activities: ReturnType<typeof memoryActivities>, overrides = {}) {
  return {
    context: { env: {}, repositories: { activities } } as unknown as ServiceContext,
    user: { id: 7 } as IUser,
    polyConversationId: "teammate_home_poly",
    installationId: "installation_inbox",
    occurrenceId: "occurrence_1",
    phase: "result" as const,
    title: "Inbox sweep",
    summary: "Two newsletters arrived.",
    resultConversationId: "recipe_occurrence_1",
    failed: false,
    ...overrides,
  };
}

function onlyHandoff(activities: ReturnType<typeof memoryActivities>) {
  const [record] = [...activities.records.values()];

  return record ? readPolyHandoff(record) : null;
}

describe("admitRoutineHandoff", () => {
  beforeEach(() => judge.mockReset());

  it("notes a routine result the judgement says can wait, without interrupting", async () => {
    judge.mockResolvedValue({ urgency: "normal", receipt: { policy: "poly.handoff_urgency" } });
    const activities = memoryActivities(0);

    await expect(admitRoutineHandoff(input(activities))).resolves.toBe("noted");
    expect(onlyHandoff(activities)?.data.reason).toBe("not_urgent");
  });

  it("interrupts for a routine waiting on the person without asking the judge", async () => {
    const activities = memoryActivities(0);

    await expect(admitRoutineHandoff(input(activities, { phase: "attention" }))).resolves.toBe(
      "notified",
    );
    expect(judge).not.toHaveBeenCalled();
  });

  it("decides each occurrence once, so a redelivered result cannot interrupt twice", async () => {
    judge.mockResolvedValue({ urgency: "high", receipt: null });
    const activities = memoryActivities(0);

    await expect(admitRoutineHandoff(input(activities))).resolves.toBe("notified");
    await expect(admitRoutineHandoff(input(activities))).resolves.toBe("notified");
    expect(judge).toHaveBeenCalledTimes(1);
    expect(activities.records.size).toBe(1);
  });

  it("notes even a failure once the day's interruptions are spent", async () => {
    const activities = memoryActivities(5);

    await expect(admitRoutineHandoff(input(activities, { failed: true }))).resolves.toBe("noted");
    expect(onlyHandoff(activities)?.data.reason).toBe("daily_cap");
  });
});
