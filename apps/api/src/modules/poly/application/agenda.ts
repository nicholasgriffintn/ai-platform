import type { PolyAgendaPromptInput } from "@ngriffin_uk/polychat-ai-prompts";
import type {
  ChatRun,
  Delegation,
  Goal,
  PolyAgenda,
  PolyAgendaItem,
} from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

const AGENDA_COLUMN_LIMIT = 8;
const AGENDA_TITLE_LIMIT = 120;
const DONE_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

const DELEGATION_NEEDS_YOU = new Set<Delegation["state"]>([
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
]);
const DELEGATION_WORKING = new Set<Delegation["state"]>(["queued", "running"]);
const DELEGATION_DONE = new Set<Delegation["state"]>(["done", "failed"]);
const GOAL_NEEDS_YOU = new Set<Goal["status"]>(["blocked", "stalled", "limit_reached"]);

export interface PolyNotedHandoff {
  id: string;
  title: string;
  reason: string;
  resultConversationId: string | null;
  createdAt: string;
}

export interface PolyAgendaInput {
  conversationId: string;
  delegations: readonly Delegation[];
  goal: Goal | null;
  latestRun: ChatRun | null;
  noted: readonly PolyNotedHandoff[];
  now: number;
}

function newestFirst(left: PolyAgendaItem, right: PolyAgendaItem): number {
  return (right.updated_at ?? "").localeCompare(left.updated_at ?? "");
}

function column(items: PolyAgendaItem[]): PolyAgendaItem[] {
  return items.sort(newestFirst).slice(0, AGENDA_COLUMN_LIMIT);
}

function delegationItem(delegation: Delegation): PolyAgendaItem {
  return {
    kind: "delegation",
    id: delegation.id,
    title: truncateSingleLine(delegation.goal, AGENDA_TITLE_LIMIT),
    status: delegation.state,
    conversation_id: delegation.childConversationId,
    updated_at: delegation.updatedAt ?? delegation.createdAt,
  };
}

function isRecent(timestamp: string | null, now: number): boolean {
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

  return Number.isFinite(parsed) && now - parsed <= DONE_HORIZON_MS;
}

export function buildPolyAgenda(input: PolyAgendaInput): PolyAgenda {
  const needsYou: PolyAgendaItem[] = [];
  const workingOn: PolyAgendaItem[] = [];
  const done: PolyAgendaItem[] = [];

  for (const delegation of input.delegations) {
    const item = delegationItem(delegation);

    if (DELEGATION_NEEDS_YOU.has(delegation.state)) {
      needsYou.push(item);
    } else if (DELEGATION_WORKING.has(delegation.state)) {
      workingOn.push(item);
    } else if (DELEGATION_DONE.has(delegation.state) && isRecent(item.updated_at, input.now)) {
      done.push(item);
    }
  }

  if (input.goal) {
    const item: PolyAgendaItem = {
      kind: "goal",
      id: input.goal.id,
      title: truncateSingleLine(input.goal.objective, AGENDA_TITLE_LIMIT),
      status: input.goal.status,
      conversation_id: input.conversationId,
      updated_at: input.goal.updated_at ?? input.goal.created_at,
    };

    if (GOAL_NEEDS_YOU.has(input.goal.status)) {
      needsYou.push(item);
    } else if (input.goal.status === "active") {
      workingOn.push(item);
    }
  }

  const run = input.latestRun;

  if (run && (run.status === "awaiting_approval" || run.status === "awaiting_input")) {
    needsYou.push({
      kind: run.status === "awaiting_approval" ? "approval" : "question",
      id: run.id,
      title:
        run.status === "awaiting_approval"
          ? "Poly is waiting for your approval"
          : "Poly asked you a question",
      status: run.status,
      conversation_id: input.conversationId,
      updated_at: run.updatedAt,
    });
  }

  const noted = input.noted.map((handoff): PolyAgendaItem => ({
    kind: "routine",
    id: handoff.id,
    title: truncateSingleLine(handoff.title, AGENDA_TITLE_LIMIT),
    status: handoff.reason,
    conversation_id: handoff.resultConversationId ?? input.conversationId,
    updated_at: handoff.createdAt,
  }));

  return {
    needs_you: column(needsYou),
    working_on: column(workingOn),
    done: column(done),
    noted: column(noted),
  };
}

function describeItem(item: PolyAgendaItem): string {
  return `${item.kind}: ${item.title} (${item.status.replaceAll("_", " ")})`;
}

export function toPolyAgendaPrompt(agenda: PolyAgenda): PolyAgendaPromptInput {
  return {
    needsYou: agenda.needs_you.map(describeItem),
    workingOn: agenda.working_on.map(describeItem),
    done: agenda.done.map(describeItem),
    noted: agenda.noted.map(describeItem),
  };
}
