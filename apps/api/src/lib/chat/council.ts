import {
	councilChatOptionsSchema,
	councilMembers,
	defaultCouncilMemberIds,
	type CouncilChatOptions,
	type CouncilMemberDefinition,
	type CouncilMemberId,
} from "@assistant/schemas";
import { parseAIResponseJson } from "~/utils/json";

const allCouncilMembers = councilMembers as readonly CouncilMemberDefinition[];
const councilMemberById = new Map(allCouncilMembers.map((member) => [member.id, member]));
const councilMemberIds = new Set(allCouncilMembers.map((member) => member.id));

export interface CouncilTurnRouting {
	shouldContinue: boolean;
	nextMemberIds: CouncilMemberId[];
	reason?: string;
}

function extractCouncilRoutingPayload(
	content: string,
): { rawPayload: string; cleanedContent: string } | null {
	const taggedMatch = content.match(/<council_next>\s*([\s\S]*?)\s*<\/council_next>/i);
	if (taggedMatch) {
		return {
			rawPayload: taggedMatch[1]?.trim() || "",
			cleanedContent: content.replace(taggedMatch[0], "").trim(),
		};
	}

	const labelledMatch = content.match(
		/(?:^|\n)\s*(?:#{1,6}\s*)?Council\s+Next\s*:?\s*(```(?:json)?[\s\S]*?```|\{[\s\S]*\})\s*$/i,
	);
	if (!labelledMatch) {
		return null;
	}

	return {
		rawPayload: labelledMatch[1]?.trim() || "",
		cleanedContent: content.replace(labelledMatch[0], "").trim(),
	};
}

function parseRoutingBoolean(value: unknown): boolean | null {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value !== "string") {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === "true") {
		return true;
	}
	if (normalized === "false") {
		return false;
	}
	return null;
}

function resolveCouncilMembers(options: CouncilChatOptions): CouncilMemberDefinition[] {
	const memberIds = options.memberIds?.length ? options.memberIds : defaultCouncilMemberIds;
	const members = memberIds
		.map((id) => councilMemberById.get(id))
		.filter((member): member is CouncilMemberDefinition => Boolean(member));

	return members.length ? members : [...allCouncilMembers];
}

export function getCouncilMemberDefinition(
	memberId: CouncilChatOptions["activeMemberId"],
): CouncilMemberDefinition | null {
	return memberId ? councilMemberById.get(memberId) || null : null;
}

export function shouldSkipCouncilInputStorage(value: unknown): boolean {
	const parsed = councilChatOptionsSchema.safeParse(value);
	return Boolean(parsed.success && parsed.data.enabled && parsed.data.skipInputStorage);
}

export function buildCouncilMessageData(value: unknown, routing?: CouncilTurnRouting | null) {
	const parsed = councilChatOptionsSchema.safeParse(value);
	if (!parsed.success || !parsed.data.enabled || !parsed.data.activeMemberId) {
		return null;
	}

	const member = getCouncilMemberDefinition(parsed.data.activeMemberId);
	if (!member) {
		return null;
	}

	return {
		council: {
			responseMode: parsed.data.responseMode,
			memberId: member.id,
			memberName: member.name,
			memberRole: member.role,
			phase: parsed.data.phase,
			round: parsed.data.round,
			turn: parsed.data.turn,
			shouldContinue: routing?.shouldContinue,
			nextMemberIds: routing?.nextMemberIds,
			nextReason: routing?.reason,
		},
	};
}

export function extractCouncilTurnRouting(
	content: string,
	value: unknown,
): { content: string; routing: CouncilTurnRouting | null } {
	const parsed = councilChatOptionsSchema.safeParse(value);
	if (!parsed.success || !parsed.data.enabled || parsed.data.responseMode !== "debate") {
		return { content, routing: null };
	}

	const routingPayload = extractCouncilRoutingPayload(content);
	if (!routingPayload) {
		return { content, routing: null };
	}

	const { rawPayload, cleanedContent } = routingPayload;
	if (parsed.data.phase === "conclusion") {
		return { content: cleanedContent, routing: null };
	}

	if (!rawPayload) {
		return { content: cleanedContent, routing: null };
	}

	const { data: payload } = parseAIResponseJson(rawPayload);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return { content: cleanedContent, routing: null };
	}

	const rawNextMemberIds = Array.isArray(payload.nextMemberIds)
		? payload.nextMemberIds
		: Array.isArray(payload.next_member_ids)
			? payload.next_member_ids
			: [];
	const allowedMemberIds = new Set(
		parsed.data.memberIds?.length ? parsed.data.memberIds : defaultCouncilMemberIds,
	);
	const nextMemberIds = rawNextMemberIds.filter((memberId): memberId is CouncilMemberId => {
		if (
			typeof memberId !== "string" ||
			!councilMemberIds.has(memberId as CouncilMemberId) ||
			!allowedMemberIds.has(memberId as CouncilMemberId)
		) {
			return false;
		}
		allowedMemberIds.delete(memberId as CouncilMemberId);
		return true;
	});
	const explicitShouldContinue =
		parseRoutingBoolean(payload.shouldContinue) ?? parseRoutingBoolean(payload.should_continue);
	const shouldContinue =
		explicitShouldContinue === null ? nextMemberIds.length > 0 : explicitShouldContinue;
	const reason =
		typeof payload.reason === "string" && payload.reason.trim() ? payload.reason.trim() : undefined;

	return {
		content: cleanedContent,
		routing: {
			shouldContinue,
			nextMemberIds: shouldContinue ? nextMemberIds : [],
			reason,
		},
	};
}

export function buildCouncilSystemPrompt(value: unknown): string | null {
	const parsed = councilChatOptionsSchema.safeParse(value);
	if (!parsed.success || !parsed.data.enabled) {
		return null;
	}

	const members = resolveCouncilMembers(parsed.data);
	const requireConsensus = parsed.data.requireConsensus ?? true;
	const activeMember = getCouncilMemberDefinition(parsed.data.activeMemberId);
	const memberList = members
		.map(
			(member) =>
				`- ${member.name} (${member.role}): traits=${member.traits.join(", ")}. ${member.systemPrompt}`,
		)
		.join("\n");

	if (parsed.data.responseMode === "debate" && parsed.data.phase === "conclusion" && activeMember) {
		return `You are concluding a multi-agent AI council debate.

<active_council_member>
Name: ${activeMember.name}
Role: ${activeMember.role}
Traits: ${activeMember.traits.join(", ")}
Instruction: ${activeMember.systemPrompt}
</active_council_member>

<selected_council>
${memberList}
</selected_council>

<conclusion_context>
- Speak as ${activeMember.name}, but conclude on behalf of the chamber.
- Use the user's problem and the prior council messages in the conversation.
- State the council's final decision, the reasoning that survived debate, and any principled dissent.
- If the council cannot decide safely, state the blocking unknowns and the exact next check needed.
- Do not add another routing tag. This is the final chamber result.
</conclusion_context>

<output_contract>
Return:
1. Decision: the chamber's result.
2. Why: concise reasoning.
3. Dissent or caveats: unresolved points only if they matter.
4. Next action: concrete step for the user.
</output_contract>`;
	}

	if (parsed.data.responseMode === "debate" && activeMember) {
		return `You are one member of an ongoing multi-agent AI council debate.

<active_council_member>
Name: ${activeMember.name}
Role: ${activeMember.role}
Traits: ${activeMember.traits.join(", ")}
Instruction: ${activeMember.systemPrompt}
</active_council_member>

<selected_council>
${memberList}
</selected_council>

<debate_context>
- This is round ${parsed.data.round ?? 1}, turn ${parsed.data.turn ?? 1}.
- Speak only as ${activeMember.name}; do not answer as the whole council.
- Stay under 120 words unless tool output forces extra detail.
- Do not recap the whole debate. Address one specific previous point: rebut it, sharpen it, or build on it.
- If you have no useful contribution, say "${activeMember.name}: Pass." and route a better member, or end the debate.
- Avoid bland agreement. If you agree, add a new consequence, risk, or surprising angle.
- If a factual, technical, or current claim needs verification, use available tools when the chat tool system exposes them. If tools are not available, mark it as [verify: claim].
- If another selected member now has useful input, choose them for the next turn. You may choose yourself again if your role needs another turn.
- If the council has converged, choose no next members and set shouldContinue to false so the chamber can conclude.
- Do not fabricate external facts. Mark unknowns as unknown and say what would need verification.
</debate_context>

<output_contract>
Start with "${activeMember.name}:"
Then give that member's debate turn only.
End with exactly one routing tag:
<council_next>{"shouldContinue":true,"nextMemberIds":["member_id"],"reason":"short reason"}</council_next>
Use only selected member ids from this list: ${members.map((member) => member.id).join(", ")}.
Use {"shouldContinue":false,"nextMemberIds":[],"reason":"consensus reached"} when no member has new input.
Choose only members with a concrete reason to speak next.
</output_contract>`;
	}

	return `You are running a multi-agent AI council inside this chat.

<council_members>
${memberList}
</council_members>

<council_process>
- Treat each council member as a distinct agent with its own role, traits, and viewpoint.
- Continue the internal debate until the council reaches a result or clearly records a principled unresolved disagreement.
- In each round, members should challenge assumptions, add evidence, identify risks, and refine the proposal.
- ${requireConsensus ? "Continue debating until the council reaches a defensible consensus or clearly records a principled unresolved disagreement." : "Consensus is preferred, but unresolved disagreement is allowed when it improves the answer."}
- Do not fabricate external facts. Mark unknowns as unknown and say what would need verification.
- Keep the final answer useful to the user, not theatrical.
</council_process>

<output_contract>
Return:
1. Council view: short summary of the agreed solution.
2. Debate notes: concise bullets naming members only where their disagreement or contribution matters.
3. Decision: concrete recommendation or next action.
4. Open risks: remaining risks, assumptions, or checks.
</output_contract>`;
}
