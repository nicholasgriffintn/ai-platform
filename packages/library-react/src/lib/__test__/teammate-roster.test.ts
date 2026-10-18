import type { TeammateResponse, TeammateRosterEntry } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildTeammateRoster } from "../teammates/roster.js";

function teammate(id: string): TeammateResponse {
  return {
    id,
    user_id: 1,
    owner_scope_type: "user",
    owner_scope_id: "1",
    derived_from_teammate_id: null,
    kind: "colleague",
    workspace_default: false,
    name: id,
    description: "",
    avatar_url: null,
    character_id: null,
    servers: [],
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    skill_ids: [],
    mode: null,
    created_at: "2026-10-18T10:00:00.000Z",
    updated_at: null,
  };
}

function thread(teammateId: string, lastActivityAt: string): TeammateRosterEntry {
  return {
    kind: "teammate",
    teammateId,
    conversationId: `home-${teammateId}`,
    lastActivityAt,
    unread: false,
  };
}

describe("teammate roster", () => {
  it("lifts whoever needs you, then busy teammates, and keeps everyone else in activity order", () => {
    const roster = buildTeammateRoster({
      entries: [
        thread("chief", "2026-10-18T12:00:00.000Z"),
        {
          kind: "group",
          conversationId: "group-1",
          name: "Offsite crew",
          teammateIds: ["chief", "scout"],
          lastActivityAt: "2026-10-18T11:00:00.000Z",
          unread: true,
        },
        thread("expenses", "2026-10-18T10:00:00.000Z"),
        thread("trips", "2026-10-18T09:00:00.000Z"),
      ],
      teammates: [teammate("chief"), teammate("scout"), teammate("expenses"), teammate("trips")],
      signal: {
        needsYou: [{ teammate_id: "trips", title: "Approve the booking" }],
        workingOn: [{ teammate_id: "expenses", title: "Match receipts" }],
      },
    });

    expect(roster.map((row) => [row.conversationId, row.urgency])).toEqual([
      ["home-trips", "needs_you"],
      ["home-expenses", "working"],
      ["home-chief", "idle"],
      ["group-1", "idle"],
    ]);
  });

  it("drops a thread whose teammate you no longer have", () => {
    const roster = buildTeammateRoster({
      entries: [thread("gone", "2026-10-18T12:00:00.000Z")],
      teammates: [teammate("chief")],
      signal: null,
    });

    expect(roster).toEqual([]);
  });
});
