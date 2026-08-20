import { getAIResponse } from "~/lib/chat/responses";
import { createServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseAIResponseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/panel" });

export const MAX_PANEL_TURNS = 10;

export interface PanelMember {
  id: string;
  name: string;
  role: string;
  instruction: string;
}

export interface PanelTurn {
  memberId: string;
  memberName: string;
  memberRole: string;
  content: string;
  turn: number;
}

export interface PanelRouting {
  shouldContinue: boolean;
  nextMemberIds: string[];
  reason?: string;
}

export interface PanelResult {
  turns: PanelTurn[];
  conclusion: string;
  model: string;
  provider?: string;
  stoppedReason: "consensus" | "turn_budget";
}

export interface RunPanelParams {
  env: IEnv;
  user?: IUser;
  /** The conversation's model. Falls back to the auxiliary model only when absent. */
  model?: string;
  provider?: string;
  question: string;
  members: readonly PanelMember[];
  openingMemberId?: string;
  concludingMemberId?: string;
  turnBrief: string;
  conclusionBrief: string;
  maxTurns?: number;
  /** Called as each turn completes, so callers can stream turns rather than batching them. */
  onTurn?: (turn: PanelTurn) => Promise<void> | void;
}

const ROUTING_TAG = "panel_next";

function buildRoutingContract(members: readonly PanelMember[], speaker: PanelMember): string {
  return `End your turn with exactly one routing tag on its own line:
<${ROUTING_TAG}>{"shouldContinue":true,"nextMemberIds":["member_id"],"reason":"short reason"}</${ROUTING_TAG}>
Valid member ids: ${members.map((member) => member.id).join(", ")}.
Choose the member with a concrete reason to speak next; you may choose yourself again if your role genuinely needs another turn.
When no member has new input, use {"shouldContinue":false,"nextMemberIds":[],"reason":"consensus reached"} so the panel can conclude.
The tag is machine-read and is stripped before the user sees your turn, so do not refer to it in your prose.
You are ${speaker.name}.`;
}

function buildMemberSystemPrompt(params: {
  member: PanelMember;
  members: readonly PanelMember[];
  brief: string;
}): string {
  const roster = params.members
    .map((member) => `- ${member.id} — ${member.name} (${member.role}): ${member.instruction}`)
    .join("\n");

  return `${params.brief}

<you>
Name: ${params.member.name}
Role: ${params.member.role}
Instruction: ${params.member.instruction}
</you>

<panel>
${roster}
</panel>

<routing>
${buildRoutingContract(params.members, params.member)}
</routing>`;
}

function buildTranscript(turns: readonly PanelTurn[]): string {
  return turns
    .map((turn) => `${turn.memberName} (${turn.memberRole}): ${turn.content}`)
    .join("\n\n");
}

/**
 * Splits a turn into the prose the user sees and the routing decision the loop consumes. A turn
 * that omits or malforms the tag ends the panel rather than guessing at a next speaker.
 */
export function extractPanelRouting(
  content: string,
  memberIds: ReadonlySet<string>,
): { content: string; routing: PanelRouting | null } {
  const match = content.match(
    new RegExp(`<${ROUTING_TAG}>\\s*([\\s\\S]*?)\\s*</${ROUTING_TAG}>`, "i"),
  );

  if (!match) {
    return { content: content.trim(), routing: null };
  }

  const cleaned = content.replace(match[0], "").trim();
  const { data: payload } = parseAIResponseJson(match[1] ?? "");

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { content: cleaned, routing: null };
  }

  const requested = Array.isArray(payload.nextMemberIds) ? payload.nextMemberIds : [];
  const nextMemberIds = requested.filter(
    (memberId): memberId is string => typeof memberId === "string" && memberIds.has(memberId),
  );
  const shouldContinue =
    typeof payload.shouldContinue === "boolean"
      ? payload.shouldContinue && nextMemberIds.length > 0
      : nextMemberIds.length > 0;

  return {
    content: cleaned,
    routing: {
      shouldContinue,
      nextMemberIds: shouldContinue ? nextMemberIds : [],
      reason: typeof payload.reason === "string" ? payload.reason.trim() : undefined,
    },
  };
}

/**
 * Runs a panel of perspectives as separate completions, each reading what came before, with each
 * turn choosing who speaks next. The turn budget is the caller's and is enforced here, so routing
 * can shorten a panel but never extend it.
 */
export async function runPanel(params: RunPanelParams): Promise<PanelResult> {
  const members = params.members;

  if (members.length === 0) {
    throw new AssistantError("A panel needs at least one member", ErrorType.PARAMS_ERROR);
  }

  const memberById = new Map(members.map((member) => [member.id, member]));
  const memberIds = new Set(memberById.keys());
  const maxTurns = Math.min(params.maxTurns ?? MAX_PANEL_TURNS, MAX_PANEL_TURNS);

  const fallback = params.model ? null : await getAuxiliaryModel(params.env, params.user);
  const model = params.model ?? fallback!.model;
  const provider = params.provider ?? fallback?.provider;
  const context = createServiceContext({ env: params.env, user: params.user });

  const complete = async (systemPrompt: string, userContent: string): Promise<string> => {
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];
    const payload: ChatCompletionParameters = {
      model,
      provider,
      messages,
      temperature: 0.7,
      max_tokens: 900,
      stream: false,
      store: false,
      env: params.env,
      context,
    };
    const result = await getAIResponse(payload);

    if (!result.response) {
      throw new AssistantError("A panel member returned no response", ErrorType.PROVIDER_ERROR);
    }

    return result.response.trim();
  };

  const turns: PanelTurn[] = [];
  const queue: string[] = [params.openingMemberId ?? members[0].id];
  let stoppedReason: PanelResult["stoppedReason"] = "consensus";

  while (queue.length > 0) {
    if (turns.length >= maxTurns) {
      stoppedReason = "turn_budget";
      break;
    }

    const member = memberById.get(queue.shift()!);

    if (!member) {
      continue;
    }

    const transcript = buildTranscript(turns);
    const userContent = transcript
      ? `Question:\n${params.question}\n\nWhat the panel has said so far:\n${transcript}\n\nGive your turn.`
      : `Question:\n${params.question}\n\nGive your turn. You are speaking first.`;

    let raw: string;

    try {
      raw = await complete(
        buildMemberSystemPrompt({ member, members, brief: params.turnBrief }),
        userContent,
      );
    } catch (error) {
      logger.warn("Panel member turn failed", { error, memberId: member.id });
      continue;
    }

    const { content, routing } = extractPanelRouting(raw, memberIds);
    const turn: PanelTurn = {
      memberId: member.id,
      memberName: member.name,
      memberRole: member.role,
      content,
      turn: turns.length + 1,
    };

    turns.push(turn);
    await params.onTurn?.(turn);

    if (routing?.shouldContinue) {
      queue.push(...routing.nextMemberIds);
    }
  }

  if (turns.length === 0) {
    throw new AssistantError("Every panel member failed to respond", ErrorType.PROVIDER_ERROR);
  }

  const concluding = params.concludingMemberId
    ? memberById.get(params.concludingMemberId)
    : undefined;
  const conclusion = await complete(
    concluding
      ? `${params.conclusionBrief}\n\nYou are ${concluding.name} (${concluding.role}), concluding on behalf of the panel.`
      : params.conclusionBrief,
    `Question:\n${params.question}\n\nPanel transcript:\n${buildTranscript(turns)}\n\nWrite the conclusion.`,
  );

  return { turns, conclusion, model, provider, stoppedReason };
}
