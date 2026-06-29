import type { CouncilMemberId } from "@assistant/schemas";

import type { ChatRequestOptions, Message } from "~/types";
import { normalizeMessage } from "./messages";
import {
	buildCouncilConclusionPrompt,
	buildCouncilTurnPrompt,
	getCouncilConclusionMemberId,
	getCouncilRoutingState,
	getOpeningCouncilMemberId,
	resolveCouncilMemberIds,
} from "./council";

export interface CouncilDebateTurnPlannerOptions {
	memberIds: CouncilMemberId[];
	model: string;
	requireConsensus?: boolean;
	createId?: () => string;
	now?: () => number;
}

export interface CouncilDebateTurnRequest {
	promptMessage: Message;
	requestMessages: Message[];
	requestOptions: ChatRequestOptions;
}

class CouncilDebateTurnPlanner {
	private readonly memberIds: CouncilMemberId[];
	private readonly createId: () => string;
	private readonly now: () => number;

	constructor(private readonly options: CouncilDebateTurnPlannerOptions) {
		this.memberIds = resolveCouncilMemberIds(options.memberIds);
		this.createId = options.createId ?? (() => crypto.randomUUID());
		this.now = options.now ?? Date.now;
	}

	openingSpeakerIds(): CouncilMemberId[] {
		return [getOpeningCouncilMemberId(this.memberIds)];
	}

	createDebateTurn({
		memberId,
		turn,
		accumulatedMessages,
	}: {
		memberId: CouncilMemberId;
		turn: number;
		accumulatedMessages: Message[];
	}): CouncilDebateTurnRequest {
		const promptMessage = this.createPromptMessage(
			buildCouncilTurnPrompt({
				memberId,
				round: 1,
				turn,
			}),
		);

		return {
			promptMessage,
			requestMessages: turn === 1 ? accumulatedMessages : [...accumulatedMessages, promptMessage],
			requestOptions: this.createRequestOptions({
				phase: "debate",
				activeMemberId: memberId,
				turn,
				skipInputStorage: turn > 1,
			}),
		};
	}

	createConclusionTurn({
		turn,
		accumulatedMessages,
	}: {
		turn: number;
		accumulatedMessages: Message[];
	}): CouncilDebateTurnRequest {
		const memberId = getCouncilConclusionMemberId(this.memberIds);
		const promptMessage = this.createPromptMessage(buildCouncilConclusionPrompt(memberId));

		return {
			promptMessage,
			requestMessages: [...accumulatedMessages, promptMessage],
			requestOptions: this.createRequestOptions({
				phase: "conclusion",
				activeMemberId: memberId,
				turn,
				skipInputStorage: true,
			}),
		};
	}

	nextSpeakerIds(message: Message | undefined): CouncilMemberId[] {
		return getCouncilRoutingState(message, this.memberIds).nextMemberIds;
	}

	private createPromptMessage(content: string): Message {
		return normalizeMessage({
			role: "user",
			content,
			id: this.createId(),
			created: this.now(),
			model: this.options.model,
		});
	}

	private createRequestOptions({
		phase,
		activeMemberId,
		turn,
		skipInputStorage,
	}: {
		phase: "debate" | "conclusion";
		activeMemberId: CouncilMemberId;
		turn: number;
		skipInputStorage: boolean;
	}): ChatRequestOptions {
		return {
			options: {
				council: {
					enabled: true,
					responseMode: "debate",
					phase,
					memberIds: this.memberIds,
					activeMemberId,
					round: 1,
					turn,
					requireConsensus: this.options.requireConsensus ?? true,
					skipInputStorage,
				},
			},
		};
	}
}

export function createCouncilDebateTurnPlanner(
	options: CouncilDebateTurnPlannerOptions,
): CouncilDebateTurnPlanner {
	return new CouncilDebateTurnPlanner(options);
}
