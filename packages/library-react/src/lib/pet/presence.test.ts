import { describe, expect, it } from "vitest";

import {
  deriveCharacterPresence,
  deriveTeammatePresence,
  type CharacterPresenceInput,
} from "./presence.js";

const NOW = Date.parse("2026-10-17T10:00:00.000Z");

function input(overrides: Partial<CharacterPresenceInput> = {}): CharacterPresenceInput {
  return {
    activity: null,
    isRecovering: false,
    voice: "off",
    reviewing: false,
    agenda: { needsYou: 0, workingOn: 0, pausedUntil: null },
    lastCompletedAt: null,
    lastActiveAt: null,
    lastArrivedAt: null,
    now: NOW,
    formatTime: (iso) => iso.slice(11, 16),
    ...overrides,
  };
}

describe("character presence", () => {
  it("waits on the person when the agenda needs them and the thread is quiet", () => {
    const presence = deriveCharacterPresence(
      input({ agenda: { needsYou: 2, workingOn: 1, pausedUntil: null } }),
    );

    expect(presence).toMatchObject({ state: "wait", accent: "alert", status: "2 things need you" });
  });

  it("puts the open thread's live work ahead of the agenda", () => {
    const presence = deriveCharacterPresence(
      input({
        activity: { startedAt: NOW - 1000, contentChars: 12, reasoningChars: 0, tools: [] },
        agenda: { needsYou: 1, workingOn: 0, pausedUntil: null },
      }),
    );

    expect(presence.state).toBe("speak");
  });

  it("puts reconnecting, the microphone and pending answers above everything else", () => {
    const busy = { needsYou: 3, workingOn: 3, pausedUntil: null };

    expect(deriveCharacterPresence(input({ isRecovering: true, voice: "listening" })).state).toBe(
      "fret",
    );
    expect(deriveCharacterPresence(input({ voice: "listening", agenda: busy })).state).toBe(
      "listen",
    );
    expect(deriveCharacterPresence(input({ reviewing: true, agenda: busy })).state).toBe("review");
  });

  it("sleeps visibly while paused and says when it wakes", () => {
    const presence = deriveCharacterPresence(
      input({ agenda: { needsYou: 0, workingOn: 2, pausedUntil: "2026-10-17T18:30:00.000Z" } }),
    );

    expect(presence).toMatchObject({
      state: "doze",
      accent: "sleep",
      status: "Paused until 18:30",
    });
  });

  it("ignores a pause that has already ended", () => {
    const presence = deriveCharacterPresence(
      input({ agenda: { needsYou: 0, workingOn: 1, pausedUntil: "2026-10-17T09:00:00.000Z" } }),
    );

    expect(presence.state).toBe("work");
  });
});

describe("teammate presence", () => {
  const signal = {
    needsYou: [{ teammate_id: "researcher", title: "Pick a venue" }],
    workingOn: [
      { teammate_id: "researcher", title: "Compare flights" },
      { teammate_id: "writer", title: "Draft the update" },
    ],
  };

  it("shows a teammate waiting on you ahead of the work it is doing", () => {
    expect(deriveTeammatePresence(signal, "researcher")).toEqual({
      state: "wait",
      status: "Waiting on you: Pick a venue",
      accent: "alert",
    });
    expect(deriveTeammatePresence(signal, "writer").state).toBe("work");
    expect(deriveTeammatePresence(signal, "editor").state).toBe("idle");
  });
});
