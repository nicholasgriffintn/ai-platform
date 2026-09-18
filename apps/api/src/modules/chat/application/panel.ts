import { userCreditActor, recordModelTurnUsage } from "@ngriffin_uk/polychat-ai-billing";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  extractUsagePayload,
  normaliseTokenUsage,
  getLogger,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { MAX_PANEL_TURNS } from "~/config/chat";
import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { getAIResponse } from "~/modules/chat/application/streaming/responses";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/panel" });

export interface PanelMember {
  id: string;
  name: string;
  role: string;
  instruction: string;
  model?: string;
  provider?: string;
}

export interface PanelTurn {
  memberId: string;
  memberName: string;
  memberRole: string;
  content: string;
  turn: number;
  model: string;
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
  completionId: string;
  usageScopeId: string;
  runId?: string;
  runAttempt?: number;
  user?: IUser;
  model?: string;
  provider?: string;
  question: string;
  members: readonly PanelMember[];
  openingMemberId?: string;
  concludingMemberId?: string;
  turnBrief: string;
  conclusionBrief: string;
  maxTurns?: number;
  onTurn?: (turn: PanelTurn) => Promise<void> | void;
}

const ROUTING_TAG = "panel_next";

function buildRoutingContract(members: readonly PanelMember[], speaker: PanelMember): string {
  return renderPrompt("apps/panel/routing-contract", {
    routingTag: ROUTING_TAG,
    memberIds: members.map((member) => member.id).join(", "),
    speakerName: speaker.name,
  });
}

function buildMemberSystemPrompt(params: {
  member: PanelMember;
  members: readonly PanelMember[];
  brief: string;
}): string {
  const roster = params.members.map(buildRosterEntry).join("\n");

  return renderPrompt("apps/panel/member-system", {
    brief: params.brief,
    memberName: params.member.name,
    memberRole: params.member.role,
    memberInstruction: params.member.instruction,
    roster,
    routingContract: buildRoutingContract(params.members, params.member),
  });
}

function buildTranscript(turns: readonly PanelTurn[]): string {
  return turns
    .map((turn) => `${turn.memberName} (${turn.memberRole}): ${turn.content}`)
    .join("\n\n");
}

function buildRosterEntry(member: PanelMember): string {
  const model = member.model ? ` [${member.model}]` : "";

  return `- ${member.id} — ${member.name} (${member.role})${model}: ${member.instruction}`;
}

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

export async function runPanel(params: RunPanelParams): Promise<PanelResult> {
  const members = params.members;

  if (members.length === 0) {
    throw new AssistantError("A panel needs at least one member", ErrorType.PARAMS_ERROR);
  }

  const memberById = new Map(members.map((member) => [member.id, member]));
  const memberIds = new Set(memberById.keys());
  const maxTurns = Math.min(params.maxTurns ?? MAX_PANEL_TURNS, MAX_PANEL_TURNS);

  const fallback = params.model ? null : await getAuxiliaryModel(params.env, params.user);
  const model = params.model ?? fallback.model;
  const provider = params.provider ?? fallback?.provider;
  const context = createServiceContext({ env: params.env, user: params.user });
  let invocationIndex = 0;

  const complete = async (
    systemPrompt: string,
    userContent: string,
    speaker?: PanelMember,
  ): Promise<string> => {
    const selectedModel = speaker?.model ?? model;
    const selectedProvider = speaker?.model ? speaker.provider : provider;
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];
    const payload: ChatCompletionParameters = {
      model: selectedModel,
      provider: selectedProvider,
      messages,
      disable_functions: true,
      stream: false,
      store: false,
      env: params.env,
      context,
    };
    const result = await getAIResponse(payload);
    const rawUsage = extractUsagePayload(result);
    const currentInvocation = invocationIndex++;

    await recordModelTurnUsage(
      createUsageRuntime({ env: params.env, repositories: context.repositories }),
      {
        actor: params.user?.id ? userCreditActor(params.user.id) : null,
        usage: normaliseTokenUsage(rawUsage),
        rawUsage,
        model: selectedModel,
        provider: selectedProvider ?? "unknown",
        completionId: params.completionId,
        messageId: `panel:${params.usageScopeId}:${currentInvocation}`,
        conversationId: params.completionId,
        runId: params.runId ?? null,
        runAttempt: params.runAttempt ?? null,
      },
    );

    if (typeof result.response !== "string" || !result.response.trim()) {
      throw new AssistantError("A panel member returned no response", ErrorType.PROVIDER_ERROR);
    }

    return result.response.trim();
  };

  const turns: PanelTurn[] = [];
  const queue: string[] = [params.openingMemberId ?? members[0].id];
  const attempted = new Set<string>();
  let attempts = 0;
  let lastError: unknown;
  let stoppedReason: PanelResult["stoppedReason"] = "consensus";

  while (queue.length > 0) {
    if (attempts >= maxTurns) {
      stoppedReason = "turn_budget";
      break;
    }

    const member = memberById.get(queue.shift());

    if (!member) {
      continue;
    }

    const transcript = buildTranscript(turns);
    const userContent = transcript
      ? renderPrompt("apps/panel/member-turn", {
          question: params.question,
          transcript,
        })
      : renderPrompt("apps/panel/opening-turn", { question: params.question });

    let raw: string;

    attempted.add(member.id);
    attempts += 1;

    try {
      raw = await complete(
        buildMemberSystemPrompt({ member, members, brief: params.turnBrief }),
        userContent,
        member,
      );
    } catch (error) {
      lastError = error;
      logger.warn("Panel member turn failed", { error, memberId: member.id });
      if (queue.length === 0) {
        const next = members.find((candidate) => !attempted.has(candidate.id));

        if (next) {
          queue.push(next.id);
        }
      }

      continue;
    }

    const { content, routing } = extractPanelRouting(raw, memberIds);
    const turn: PanelTurn = {
      memberId: member.id,
      memberName: member.name,
      memberRole: member.role,
      content,
      turn: turns.length + 1,
      model: member.model ?? model,
    };

    turns.push(turn);
    await params.onTurn?.(turn);

    if (routing?.shouldContinue) {
      queue.push(...routing.nextMemberIds);
    }
  }

  if (turns.length === 0) {
    throw lastError instanceof Error
      ? lastError
      : new AssistantError("No panel member produced a response", ErrorType.PROVIDER_ERROR);
  }

  const concluding = params.concludingMemberId
    ? memberById.get(params.concludingMemberId)
    : undefined;
  const conclusion = await complete(
    concluding
      ? renderPrompt("apps/panel/conclusion-brief", {
          brief: params.conclusionBrief,
          memberName: concluding.name,
          memberRole: concluding.role,
        })
      : params.conclusionBrief,
    renderPrompt("apps/panel/conclusion-turn", {
      question: params.question,
      transcript: buildTranscript(turns),
    }),
  );

  return { turns, conclusion, model, provider, stoppedReason };
}
