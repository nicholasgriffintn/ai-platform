import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { PolyHandoffRow } from "~/infrastructure/database/schema";
import type { CreatePolyHandoffParams } from "~/modules/poly/infrastructure/PolyHandoffRepository";
import type { IUser } from "~/types";

import { admitRoutineHandoff } from "../handoffs";

const judge = vi.hoisted(() => vi.fn());

vi.mock("../handoff-judgement", () => ({ judgeRoutineResult: judge }));

function memoryHandoffs(notifiedToday: number) {
  const rows = new Map<string, PolyHandoffRow>();

  return {
    rows,
    getByFingerprint: async (_contextId: string, fingerprint: string) =>
      rows.get(fingerprint) ?? null,
    listNotifiedSince: async () =>
      Array.from({ length: notifiedToday }, (_, index) =>
        new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
      ),
    insertOnce: async (params: CreatePolyHandoffParams) => {
      const row: PolyHandoffRow = {
        id: params.id,
        context_id: params.contextId,
        source_kind: params.sourceKind,
        source_id: params.sourceId,
        fingerprint: params.fingerprint,
        title: params.title,
        summary: params.summary,
        result_conversation_id: params.resultConversationId,
        urgency: params.urgency,
        decision: params.decision,
        reason: params.reason,
        admission_receipt_json: params.admissionReceipt,
        created_at: params.createdAt,
      };

      rows.set(params.fingerprint, rows.get(params.fingerprint) ?? row);

      return rows.get(params.fingerprint) ?? row;
    },
  };
}

function input(handoffs: ReturnType<typeof memoryHandoffs>, overrides = {}) {
  return {
    context: { env: {}, repositories: { polyHandoffs: handoffs } } as unknown as ServiceContext,
    user: { id: 7 } as IUser,
    polyContextId: "teammate_context_poly",
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

describe("admitRoutineHandoff", () => {
  beforeEach(() => judge.mockReset());

  it("notes a routine result the judgement says can wait, without interrupting", async () => {
    judge.mockResolvedValue({ urgency: "normal", receipt: { policy: "poly.handoff_urgency" } });
    const handoffs = memoryHandoffs(0);

    await expect(admitRoutineHandoff(input(handoffs))).resolves.toBe("noted");
    expect(handoffs.rows.get("routine:occurrence_1:result")?.reason).toBe("not_urgent");
  });

  it("interrupts for a routine waiting on the person without asking the judge", async () => {
    const handoffs = memoryHandoffs(0);

    await expect(admitRoutineHandoff(input(handoffs, { phase: "attention" }))).resolves.toBe(
      "notified",
    );
    expect(judge).not.toHaveBeenCalled();
  });

  it("decides each occurrence once, so a redelivered result cannot interrupt twice", async () => {
    judge.mockResolvedValue({ urgency: "high", receipt: null });
    const handoffs = memoryHandoffs(0);

    await expect(admitRoutineHandoff(input(handoffs))).resolves.toBe("notified");
    await expect(admitRoutineHandoff(input(handoffs))).resolves.toBe("notified");
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("notes even a failure once the day's interruptions are spent", async () => {
    const handoffs = memoryHandoffs(5);

    await expect(admitRoutineHandoff(input(handoffs, { failed: true }))).resolves.toBe("noted");
    expect(handoffs.rows.get("routine:occurrence_1:result")?.reason).toBe("daily_cap");
  });
});
