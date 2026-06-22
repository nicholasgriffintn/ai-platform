import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { createCouncilDebateTurnPlanner } from "../council-turns";

const baseMessages: Message[] = [
	{
		id: "user-1",
		role: "user",
		content: "Should we ship this?",
		model: "gpt-4",
	},
];

describe("createCouncilDebateTurnPlanner", () => {
	it("builds debate turn requests without adding a synthetic prompt on the opening turn", () => {
		const planner = createCouncilDebateTurnPlanner({
			memberIds: ["architect", "security"],
			model: "gpt-4",
			requireConsensus: false,
			createId: () => "turn-id",
			now: () => 1234,
		});

		const turn = planner.createDebateTurn({
			memberId: "architect",
			turn: 1,
			accumulatedMessages: baseMessages,
		});

		expect(turn.requestMessages).toBe(baseMessages);
		expect(turn.promptMessage).toEqual(
			expect.objectContaining({
				id: "turn-id",
				role: "user",
				model: "gpt-4",
				created: 1234,
				content: expect.stringContaining("Council turn 1, round 1."),
			}),
		);
		expect(turn.requestOptions).toEqual({
			council: {
				enabled: true,
				responseMode: "debate",
				phase: "debate",
				memberIds: ["architect", "security"],
				activeMemberId: "architect",
				round: 1,
				turn: 1,
				requireConsensus: false,
				skipInputStorage: false,
			},
		});
	});

	it("adds synthetic prompts after the opening turn and builds conclusion requests", () => {
		const planner = createCouncilDebateTurnPlanner({
			memberIds: ["architect", "security"],
			model: "gpt-4",
			createId: () => "message-id",
			now: () => 5678,
		});

		const debateTurn = planner.createDebateTurn({
			memberId: "security",
			turn: 2,
			accumulatedMessages: baseMessages,
		});
		const conclusion = planner.createConclusionTurn({
			turn: 3,
			accumulatedMessages: baseMessages,
		});

		expect(debateTurn.requestMessages).toHaveLength(2);
		expect(debateTurn.requestMessages[1]).toEqual(debateTurn.promptMessage);
		expect(debateTurn.requestOptions.council?.skipInputStorage).toBe(true);
		expect(conclusion.requestMessages).toHaveLength(2);
		expect(conclusion.requestOptions.council).toEqual(
			expect.objectContaining({
				enabled: true,
				responseMode: "debate",
				phase: "conclusion",
				activeMemberId: "architect",
				turn: 3,
				requireConsensus: true,
				skipInputStorage: true,
			}),
		);
	});

	it("derives the next speaker queue from council routing metadata", () => {
		const planner = createCouncilDebateTurnPlanner({
			memberIds: ["architect", "security"],
			model: "gpt-4",
		});

		expect(
			planner.nextSpeakerIds({
				id: "assistant-1",
				role: "assistant",
				content: "Security should respond.",
				data: {
					council: {
						shouldContinue: true,
						nextMemberIds: ["security", "security", "unknown"],
					},
				},
			}),
		).toEqual(["security"]);
	});
});
