import { describe, expect, it } from "vitest";

import {
	buildCouncilMessageData,
	extractCouncilTurnRouting,
	shouldSkipCouncilInputStorage,
} from "../council";

describe("council chat metadata", () => {
	it("builds message metadata for active council turns and next speakers", () => {
		expect(
			buildCouncilMessageData(
				{
					enabled: true,
					responseMode: "debate",
					phase: "debate",
					activeMemberId: "security",
					round: 1,
					turn: 4,
				},
				{
					shouldContinue: true,
					nextMemberIds: ["sceptic"],
					reason: "assumptions need testing",
				},
			),
		).toEqual({
			council: {
				responseMode: "debate",
				memberId: "security",
				memberName: "Security",
				memberRole: "risk analyst",
				phase: "debate",
				round: 1,
				turn: 4,
				shouldContinue: true,
				nextMemberIds: ["sceptic"],
				nextReason: "assumptions need testing",
			},
		});
	});

	it("extracts and cleans council routing tags", () => {
		const result = extractCouncilTurnRouting(
			'Security: Check auth boundaries.\n<council_next>{"shouldContinue":true,"nextMemberIds":["sceptic","chair","unknown"],"reason":"needs challenge"}</council_next>',
			{
				enabled: true,
				responseMode: "debate",
				memberIds: ["security", "sceptic"],
				activeMemberId: "security",
			},
		);

		expect(result.content).toBe("Security: Check auth boundaries.");
		expect(result.routing).toEqual({
			shouldContinue: true,
			nextMemberIds: ["sceptic"],
			reason: "needs challenge",
		});
	});

	it("strips routing tags from conclusion turns without continuing debate", () => {
		const result = extractCouncilTurnRouting(
			'Decision made.\n<council_next>{"shouldContinue":true,"nextMemberIds":["sceptic"]}</council_next>',
			{
				enabled: true,
				responseMode: "debate",
				phase: "conclusion",
				memberIds: ["security", "sceptic"],
				activeMemberId: "security",
			},
		);

		expect(result.content).toBe("Decision made.");
		expect(result.routing).toBeNull();
	});

	it("parses model routing with markdown fenced JSON and string booleans", () => {
		const result = extractCouncilTurnRouting(
			'Done.\n<council_next>```json\n{"shouldContinue":"false","nextMemberIds":["sceptic"]}\n```</council_next>',
			{
				enabled: true,
				responseMode: "debate",
				memberIds: ["security", "sceptic"],
				activeMemberId: "security",
			},
		);

		expect(result.content).toBe("Done.");
		expect(result.routing).toEqual({
			shouldContinue: false,
			nextMemberIds: [],
			reason: undefined,
		});
	});

	it("parses visible Council Next routing labels used by weaker models", () => {
		const result = extractCouncilTurnRouting(
			'Security: Risk is resolved.\n\nCouncil Next\n\n{"shouldContinue":false,"nextMemberIds":[],"reason":"done"}',
			{
				enabled: true,
				responseMode: "debate",
				memberIds: ["security", "sceptic"],
				activeMemberId: "security",
			},
		);

		expect(result.content).toBe("Security: Risk is resolved.");
		expect(result.routing).toEqual({
			shouldContinue: false,
			nextMemberIds: [],
			reason: "done",
		});
	});

	it("detects synthetic council turn storage skips", () => {
		expect(shouldSkipCouncilInputStorage({ enabled: true, skipInputStorage: true })).toBe(true);
		expect(shouldSkipCouncilInputStorage({ enabled: true, skipInputStorage: false })).toBe(false);
		expect(shouldSkipCouncilInputStorage({ enabled: false, skipInputStorage: true })).toBe(false);
	});
});
