import {
  councilMemberIds,
  councilMembers,
  type CouncilMemberDefinition,
  type CouncilMemberId,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { runPanel, type PanelMember, type PanelTurn } from "~/lib/chat/panel";

import type { ApiToolDefinition } from "../../types/functions";

const MAX_COUNCIL_MEMBERS = 6;
const MAX_COUNCIL_TURNS = 8;
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
      responseType: "council_turn",
      memberId: turn.memberId,
      memberName: turn.memberName,
      memberRole: turn.memberRole,
      turn: turn.turn,
      content: turn.content,
    },
  };
}

export const run_council: ApiToolDefinition = {
  name: "run_council",
  description:
    "Convene a council of named perspectives to debate one question. Each member answers in its own completion using the conversation's model, reading what came before, and each turn chooses who speaks next until the chamber converges. Turns appear in the conversation as they happen. Use for genuinely contested decisions and designs, not for questions with a retrievable answer.",
  type: "normal",
  costPerCall: 2,
  permissions: ["orchestration"],
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .max(4000)
      .describe("The question the council should debate, stated in full."),
    memberIds: z
      .array(z.enum(councilMemberIds))
      .max(MAX_COUNCIL_MEMBERS)
      .optional()
      .describe(
        "Members to convene. Choose perspectives that genuinely disagree about this question. Defaults to sceptic, architect, strategist, synthesiser.",
      ),
    maxTurns: z
      .number()
      .int()
      .min(2)
      .max(MAX_COUNCIL_TURNS)
      .optional()
      .describe(
        `Upper bound on debate turns before the council must conclude. Defaults to ${MAX_COUNCIL_TURNS}.`,
      ),
  }),
  execute: async (args, context) => {
    const request = context.request;
    const members = resolveMembers(args.memberIds);
    const result = await runPanel({
      env: request.env,
      user: request.user,
      // The council debates on the conversation's model, not a cheaper auxiliary one.
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
        responseType: "council_conclusion",
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
