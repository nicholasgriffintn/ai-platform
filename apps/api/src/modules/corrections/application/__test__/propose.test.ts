import type { Correction } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { proposeCorrection } from "../propose";

const tryDecide = vi.hoisted(() => vi.fn(async () => null));

vi.mock("~/infrastructure/ai", () => ({ ai: { tryDecide } }));

const existing: Correction = {
  id: "correction_1",
  pattern: "Use British spelling in client emails",
  quote: "please stop writing color",
  placement: "memory",
  placementRef: null,
  recurrences: 0,
  status: "active",
  createdAt: "2026-10-01T09:00:00.000Z",
  lastRecurredAt: null,
};

function setup(active: Correction[] = []) {
  const corrections = {
    listActive: vi.fn(async () => active),
    create: vi.fn(async () => undefined),
    recordRecurrence: vi.fn(async () => undefined),
  };
  const context = {
    env: {},
    user: { id: 7 },
    requireUser: () => ({ id: 7 }),
    repositories: {
      corrections,
      messages: {
        getRecentUserMessageContents: async () => [
          "No, use British spelling in client emails. Colour, not color!",
        ],
      },
    },
  } as unknown as ServiceContext;

  return { context, corrections };
}

const input = {
  conversationId: "conversation_1",
  teammateContextId: null,
  pattern: "Use British spelling in client emails",
  quote: "use British spelling in client emails",
};

describe("proposeCorrection", () => {
  it("refuses a quote the person never said", async () => {
    const { context } = setup();
    const place = vi.fn();

    await expect(
      proposeCorrection(context, {
        ...input,
        quote: "always use American spelling",
        placement: "memory",
        place,
      }),
    ).rejects.toThrow("must quote what the person actually said");
    expect(place).not.toHaveBeenCalled();
  });

  it("records a new rule where it was placed", async () => {
    const { context, corrections } = setup();
    const outcome = await proposeCorrection(context, {
      ...input,
      placement: "memory",
      place: async () => ({ placementRef: "memory_doc", note: "Saved." }),
    });

    expect(outcome).toMatchObject({ kind: "recorded", recurred: false });
    expect(corrections.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, placement: "memory", placementRef: "memory_doc" }),
    );
  });

  it("does not write the same rule to memory twice and counts the repeat", async () => {
    const { context, corrections } = setup([existing]);
    const place = vi.fn();
    const outcome = await proposeCorrection(context, {
      ...input,
      pattern: "use british spelling in client emails.",
      placement: "memory",
      place,
    });

    expect(outcome).toEqual({ kind: "already_recorded", correction: existing });
    expect(place).not.toHaveBeenCalled();
    expect(corrections.create).not.toHaveBeenCalled();
    expect(corrections.recordRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({ id: existing.id, placement: "memory" }),
    );
  });

  it("moves a repeated rule into a skill instead of adding a duplicate", async () => {
    const { context, corrections } = setup([existing]);
    const outcome = await proposeCorrection(context, {
      ...input,
      placement: "skill",
      place: async () => ({ placementRef: "client-emails", note: "Drafted." }),
    });

    expect(outcome).toMatchObject({
      kind: "recorded",
      correctionId: existing.id,
      recurred: true,
      placement: "skill",
    });
    expect(corrections.create).not.toHaveBeenCalled();
    expect(corrections.recordRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existing.id,
        placement: "skill",
        placementRef: "client-emails",
      }),
    );
  });
});
