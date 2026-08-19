import { getAIResponse } from "~/lib/chat/responses";
import { createServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/panel" });

export const MAX_PANEL_TURNS = 12;

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
}

export interface PanelResult {
  turns: PanelTurn[];
  conclusion: string;
  model: string;
}

export interface RunPanelParams {
  env: IEnv;
  user?: IUser;
  question: string;
  members: readonly PanelMember[];
  turnBrief: string;
  conclusionBrief: string;
  maxTurns?: number;
}

function buildMemberSystemPrompt(params: {
  member: PanelMember;
  members: readonly PanelMember[];
  brief: string;
}): string {
  const roster = params.members
    .map((member) => `- ${member.name} (${member.role}): ${member.instruction}`)
    .join("\n");

  return `${params.brief}

<you>
Name: ${params.member.name}
Role: ${params.member.role}
Instruction: ${params.member.instruction}
</you>

<panel>
${roster}
</panel>`;
}

function buildTranscript(turns: readonly PanelTurn[]): string {
  return turns
    .map((turn) => `${turn.memberName} (${turn.memberRole}): ${turn.content}`)
    .join("\n\n");
}

/**
 * Runs a fixed roster of perspectives as separate completions, then a closing turn that reads the
 * whole transcript. The roster and ordering are decided by the caller: this primitive never lets a
 * turn choose who speaks next, so a panel cannot extend itself past the caller's turn budget.
 */
export async function runPanel(params: RunPanelParams): Promise<PanelResult> {
  const members = params.members.slice(0, params.maxTurns ?? MAX_PANEL_TURNS);

  if (members.length === 0) {
    throw new AssistantError("A panel needs at least one member", ErrorType.PARAMS_ERROR);
  }

  const { model, provider } = await getAuxiliaryModel(params.env, params.user);
  const context = createServiceContext({ env: params.env, user: params.user });
  const turns: PanelTurn[] = [];

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

  for (const member of members) {
    const transcript = buildTranscript(turns);
    const userContent = transcript
      ? `Question:\n${params.question}\n\nWhat the panel has said so far:\n${transcript}\n\nGive your turn.`
      : `Question:\n${params.question}\n\nGive your turn. You are speaking first.`;

    try {
      const content = await complete(
        buildMemberSystemPrompt({ member, members, brief: params.turnBrief }),
        userContent,
      );

      turns.push({
        memberId: member.id,
        memberName: member.name,
        memberRole: member.role,
        content,
      });
    } catch (error) {
      logger.warn("Panel member turn failed", { error, memberId: member.id });
    }
  }

  if (turns.length === 0) {
    throw new AssistantError("Every panel member failed to respond", ErrorType.PROVIDER_ERROR);
  }

  const conclusion = await complete(
    params.conclusionBrief,
    `Question:\n${params.question}\n\nPanel transcript:\n${buildTranscript(turns)}\n\nWrite the conclusion.`,
  );

  return { turns, conclusion, model };
}
