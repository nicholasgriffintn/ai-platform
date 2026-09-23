import { getCouncilMemberPrompt, getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { pendingSelection } from "@ngriffin_uk/polychat-library-interactions";
import {
  councilMembers,
  type CouncilMemberDefinition,
  type CouncilMemberId,
} from "@ngriffin_uk/polychat-schemas";

import { MAX_COUNCIL_MEMBERS, MAX_COUNCIL_TURNS } from "~/config/limits";
import { runPanel, type PanelMember, type PanelTurn } from "~/modules/chat/application/panel";
import { judgeCouncilDecision } from "~/modules/decisions/application/council-decision";
import type { ApiToolDefinition } from "~/types/functions";

import {
  select_council_members as select_council_membersDescriptor,
  run_council as run_councilDescriptor,
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

const TURN_BRIEF = getPromptText("apps/functions/council-turn");
const CONCLUSION_BRIEF = getPromptText("apps/functions/council-conclusion");

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
      instruction: getCouncilMemberPrompt(member.id),
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
        decision: args.decision,
        maxSelection: MAX_COUNCIL_MEMBERS,
        humanInTheLoop: pendingSelection(),
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
      runId: request.request?.run_id,
      runAttempt: request.request?.run_attempt,
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
    const decision = args.decision
      ? await judgeCouncilDecision({
          env: request.env,
          user: request.user,
          completionId: context.completionId,
          question: String(args.question),
          decision: args.decision,
          turns: result.turns,
          conclusion: result.conclusion,
        })
      : undefined;

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
        ...(decision ? { decision, decisionOptions: args.decision?.options } : {}),
      },
    };
  },
};
