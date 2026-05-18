import {
	councilMembers,
	defaultCouncilMemberIds,
	type CouncilMemberDefinition,
	type CouncilMemberId,
} from "@assistant/schemas";
import type { Message } from "~/types";

const councilMemberById = new Map<CouncilMemberId, CouncilMemberDefinition>(
	councilMembers.map((member) => [member.id, member]),
);

export function getCouncilMember(memberId: CouncilMemberId): CouncilMemberDefinition {
	return councilMemberById.get(memberId) || councilMemberById.get("chair")!;
}

export function resolveCouncilMemberIds(memberIds: CouncilMemberId[]): CouncilMemberId[] {
	return memberIds.length ? memberIds : [...defaultCouncilMemberIds];
}

export function getOpeningCouncilMemberId(memberIds: CouncilMemberId[]): CouncilMemberId {
	return memberIds.includes("chair") ? "chair" : memberIds[0] || "chair";
}

export function getCouncilConclusionMemberId(memberIds: CouncilMemberId[]): CouncilMemberId {
	if (memberIds.includes("synthesiser")) {
		return "synthesiser";
	}
	return getOpeningCouncilMemberId(memberIds);
}

export interface CouncilRoutingState {
	shouldContinue: boolean;
	nextMemberIds: CouncilMemberId[];
}

export function getCouncilRoutingState(
	message: Message | undefined,
	memberIds: CouncilMemberId[],
): CouncilRoutingState {
	const allowedMemberIds = new Set(memberIds);
	const councilData =
		message?.data && typeof message.data === "object" && "council" in message.data
			? message.data.council
			: undefined;

	if (!councilData?.shouldContinue || !Array.isArray(councilData.nextMemberIds)) {
		return {
			shouldContinue: false,
			nextMemberIds: [],
		};
	}

	const nextMemberIds = councilData.nextMemberIds.filter(
		(memberId): memberId is CouncilMemberId => {
			if (typeof memberId !== "string" || !allowedMemberIds.has(memberId as CouncilMemberId)) {
				return false;
			}
			allowedMemberIds.delete(memberId as CouncilMemberId);
			return true;
		},
	);

	return {
		shouldContinue: true,
		nextMemberIds,
	};
}

export function buildCouncilTurnPrompt({
	memberId,
	round,
	turn,
}: {
	memberId: CouncilMemberId;
	round: number;
	turn: number;
}): string {
	const member = getCouncilMember(memberId);
	return [
		`Council turn ${turn}, round ${round}.`,
		`${member.name}, respond as your council role: ${member.role}.`,
		"Make one sharp contribution. Rebut, sharpen, or build on one prior point. Pass if you have no useful input.",
		"Choose only selected members with concrete useful next input. You may choose yourself again. Stop only when no selected member has useful new input.",
	].join(" ");
}

export function buildCouncilConclusionPrompt(memberId: CouncilMemberId): string {
	const member = getCouncilMember(memberId);
	return [
		"Council conclusion.",
		`${member.name}, conclude the chamber as ${member.role}.`,
		"State the final result, the reasoning that survived debate, any material dissent, and the next action.",
		"Do not continue debate.",
	].join(" ");
}
