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
