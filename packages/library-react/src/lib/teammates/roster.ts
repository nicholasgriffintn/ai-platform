import type { TeammateResponse, TeammateRosterEntry } from "@ngriffin_uk/polychat-schemas";

import { deriveTeammatePresence, type TeammateWorkSignal } from "../pet/presence.js";

export const TEAMMATE_ROSTER_QUERY_KEY = ["teammate-roster"] as const;

export type RosterUrgency = "needs_you" | "working" | "idle";

export type RosterRow =
  | {
      kind: "teammate";
      conversationId: string;
      teammate: TeammateResponse;
      urgency: RosterUrgency;
      unread: boolean;
      status: string;
    }
  | {
      kind: "group";
      conversationId: string;
      name: string;
      members: TeammateResponse[];
      urgency: RosterUrgency;
      unread: boolean;
      status: string;
    };

const URGENCY_RANK: Record<RosterUrgency, number> = { needs_you: 0, working: 1, idle: 2 };

function urgencyOf(state: string): RosterUrgency {
  if (state === "wait") {
    return "needs_you";
  }

  return state === "work" ? "working" : "idle";
}

function findTeammate(
  teammates: readonly TeammateResponse[],
  teammateId: string,
): TeammateResponse | undefined {
  return teammates.find((teammate) => teammate.id === teammateId);
}

function toRow(
  entry: TeammateRosterEntry,
  teammates: readonly TeammateResponse[],
  signal: TeammateWorkSignal | null,
): RosterRow | null {
  if (entry.kind === "group") {
    const members = entry.teammateIds.flatMap((teammateId) => {
      const member = findTeammate(teammates, teammateId);

      return member ? [member] : [];
    });

    return {
      kind: "group",
      conversationId: entry.conversationId,
      name: entry.name,
      members,
      urgency: "idle",
      unread: entry.unread,
      status: members.map((member) => member.name).join(", "),
    };
  }

  const teammate = findTeammate(teammates, entry.teammateId);

  if (!teammate) {
    return null;
  }

  const presence = deriveTeammatePresence(signal, teammate.id);

  return {
    kind: "teammate",
    conversationId: entry.conversationId,
    teammate,
    urgency: urgencyOf(presence.state),
    unread: entry.unread,
    status: presence.status,
  };
}

export function buildTeammateRoster(params: {
  entries: readonly TeammateRosterEntry[];
  teammates: readonly TeammateResponse[];
  signal: TeammateWorkSignal | null;
}): RosterRow[] {
  return params.entries
    .flatMap((entry, index) => {
      const row = toRow(entry, params.teammates, params.signal);

      return row ? [{ row, index }] : [];
    })
    .sort(
      (left, right) =>
        URGENCY_RANK[left.row.urgency] - URGENCY_RANK[right.row.urgency] ||
        left.index - right.index,
    )
    .map(({ row }) => row);
}
