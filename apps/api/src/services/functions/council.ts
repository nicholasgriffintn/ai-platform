import {
  councilMemberIds,
  councilMembers,
  type CouncilMemberDefinition,
  type CouncilMemberId,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { runPanel, type PanelMember } from "~/lib/chat/panel";

import type { ApiToolDefinition } from "../../types/functions";

const MAX_COUNCIL_MEMBERS = 6;
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
- If you have nothing useful to add, say so in one line rather than padding.`;

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

export const run_council: ApiToolDefinition = {
  name: "run_council",
  description:
    "Convene a council of named perspectives on one question. Each member answers in its own completion, reading what the earlier members said, and a closing turn writes the chamber's result. Use for genuinely contested decisions and designs, not for questions with a retrievable answer.",
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
        "Members to convene, in speaking order. Choose perspectives that genuinely disagree about this question. Defaults to sceptic, architect, strategist, synthesiser.",
      ),
  }),
  execute: async (args, context) => {
    const request = context.request;
    const members = resolveMembers(args.memberIds);
    const result = await runPanel({
      env: request.env,
      user: request.user,
      question: String(args.question),
      members,
      turnBrief: TURN_BRIEF,
      conclusionBrief: CONCLUSION_BRIEF,
    });

    const transcript = result.turns
      .map((turn) => `### ${turn.memberName} (${turn.memberRole})\n\n${turn.content}`)
      .join("\n\n");

    return {
      status: "success",
      name: "run_council",
      content: `<council_transcript>\n${transcript}\n</council_transcript>\n\n<council_conclusion>\n${result.conclusion}\n</council_conclusion>`,
      data: {
        question: args.question,
        members: members.map((member) => member.id),
        turns: result.turns,
        conclusion: result.conclusion,
        model: result.model,
      },
    };
  },
};
