import {
  councilMembers,
  type CouncilMemberDefinition,
  type CouncilMemberId,
} from "@ngriffin_uk/polychat-schemas";

import { runPanel, type PanelMember, type PanelTurn } from "~/lib/chat/panel";

import type { ApiToolDefinition } from "../../types/functions";
import {
  select_council_members as select_council_membersDescriptor,
  run_council as run_councilDescriptor,
  MAX_COUNCIL_MEMBERS,
  MAX_COUNCIL_TURNS,
} from "./definitions/council";

const DEFAULT_COUNCIL_MEMBER_IDS: CouncilMemberId[] = [
  "sceptic",
  "architect",
  "strategist",
  "synthesiser",
];

const councilMemberById = new Map<CouncilMemberId, CouncilMemberDefinition>(
  (councilMembers as readonly CouncilMemberDefinition[]).map((member) => [member.id, member]),
);

const TURN_BRIEF = `You are one member of a council convened to pressure-test a question. Speak only as yourself.

- Make one sharp contribution. Rebut, sharpen, or build on a specific point another member made.
- Do not summarise the debate or restate agreement. If you agree, add the consequence nobody has named.
- Stay under 150 words.
- Do not fabricate facts. Mark anything you cannot verify as unverified and say what would settle it.
- If you have nothing useful to add, say so in one line and route to a member who does, or end the debate.`;

const CONCLUSION_BRIEF = `You are closing a council debate. Read the whole transcript and write the chamber's result.

- State the decision or answer the debate reached.
- Give the reasoning that survived challenge, not a summary of who said what.
- Record any dissent that a reasonable person would still hold, and why.
- Name the concrete next action, or the exact unknown that blocks one.
- Do not invent agreement that the transcript does not support.`;

function resolveMembers(requested: unknown): PanelMember[] {
  const ids =
    Array.isArray(requested) && requested.length > 0 ? requested : DEFAULT_COUNCIL_MEMBER_IDS;
  const seen = new Set<string>();
  const members: PanelMember[] = [];

  for (const id of ids) {
    const member = councilMemberById.get(id as CouncilMemberId);

    if (!member || seen.has(member.id) || members.length >= MAX_COUNCIL_MEMBERS) {
      continue;
    }

    seen.add(member.id);
    members.push({
      id: member.id,
      name: member.name,
      role: member.role,
      instruction: member.systemPrompt,
    });
  }

  return members.length > 0 ? members : resolveMembers(DEFAULT_COUNCIL_MEMBER_IDS);
}

function openingMemberId(members: readonly PanelMember[]): string {
  return (members.find((member) => member.id === "chair") ?? members[0]).id;
}

function concludingMemberId(members: readonly PanelMember[]): string {
  return (members.find((member) => member.id === "synthesiser") ?? members[0]).id;
}

function buildTurnResponse(turn: PanelTurn) {
  return {
    status: "success" as const,
    name: "council_turn",
    content: turn.content,
    data: {
      renderer: "council_turn",
      memberId: turn.memberId,
      memberName: turn.memberName,
      memberRole: turn.memberRole,
      turn: turn.turn,
      content: turn.content,
    },
  };
}

export const select_council_members: ApiToolDefinition = {
  ...select_council_membersDescriptor,
  execute: async (args, context) => {
    const recommended =
      Array.isArray(args.recommended) && args.recommended.length > 0
        ? resolveMembers(args.recommended).map((member) => member.id)
        : DEFAULT_COUNCIL_MEMBER_IDS;

    return {
      status: "pending",
      name: "select_council_members",
      content:
        "Waiting for the user to choose the council. Do not convene it or answer the question until they have.",
      data: {
        renderer: "council_member_picker",
        completion_id: context.completionId,
        question: args.question,
        members: (councilMembers as readonly CouncilMemberDefinition[]).map((member) => ({
          id: member.id,
          name: member.name,
          role: member.role,
        })),
        recommended,
        reason: args.reason,
        maxSelection: MAX_COUNCIL_MEMBERS,
        humanInTheLoop: {
          type: "selection",
          status: "pending",
          requires_user_action: true,
        },
      },
    };
  },
};

export const run_council: ApiToolDefinition = {
  ...run_councilDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const members = resolveMembers(args.memberIds);
    const result = await runPanel({
      env: request.env,
      completionId: context.completionId,
      usageScopeId: context.toolCallId ?? context.completionId,
      user: request.user,
      model: request.request?.model,
      provider: request.request?.provider,
      question: String(args.question),
      members,
      openingMemberId: openingMemberId(members),
      concludingMemberId: concludingMemberId(members),
      turnBrief: TURN_BRIEF,
      conclusionBrief: CONCLUSION_BRIEF,
      maxTurns: Number(args.maxTurns) || MAX_COUNCIL_TURNS,
      onTurn: async (turn) => {
        await context.emitToolResult?.(buildTurnResponse(turn));
      },
    });

    return {
      status: "success",
      name: "run_council",
      content: `<council_conclusion>\n${result.conclusion}\n</council_conclusion>`,
      data: {
        renderer: "council_conclusion",
        question: args.question,
        members: members.map((member) => member.id),
        turns: result.turns,
        conclusion: result.conclusion,
        stoppedReason: result.stoppedReason,
        model: result.model,
      },
    };
  },
};
