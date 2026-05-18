import { describe, expect, it } from "vitest";

import {
	buildCouncilMessageData,
	buildCouncilSystemPrompt,
	extractCouncilTurnRouting,
	shouldSkipCouncilInputStorage,
} from "../council";

describe("buildCouncilSystemPrompt", () => {
	it("returns null when council mode is not enabled", () => {
		expect(buildCouncilSystemPrompt(undefined)).toBeNull();
		expect(buildCouncilSystemPrompt({ enabled: false })).toBeNull();
	});

	it("builds a prompt with selected council personalities", () => {
		const prompt = buildCouncilSystemPrompt({
			enabled: true,
			memberIds: ["chair", "sceptic", "security", "joker", "wildcard"],
			requireConsensus: true,
		});

		expect(prompt).toContain("multi-agent AI council");
		expect(prompt).toContain("Chair (facilitator)");
		expect(prompt).toContain("Sceptic (assumption tester)");
		expect(prompt).toContain("Security (risk analyst)");
		expect(prompt).toContain("Joker (chaos spark)");
		expect(prompt).toContain("Wildcard (reframer)");
		expect(prompt).toContain("Continue the internal debate until the council reaches a result");
		expect(prompt).toContain("reaches a defensible consensus");
	});

	it("builds an active member prompt for debate turns", () => {
		const prompt = buildCouncilSystemPrompt({
			enabled: true,
			responseMode: "debate",
			memberIds: ["chair", "sceptic"],
			activeMemberId: "sceptic",
			round: 1,
			turn: 2,
		});

		expect(prompt).toContain("one member of an ongoing multi-agent AI council debate");
		expect(prompt).toContain("Name: Sceptic");
		expect(prompt).toContain("Speak only as Sceptic");
		expect(prompt).toContain("Stay under 120 words");
		expect(prompt).toContain("Pass.");
		expect(prompt).toContain('Start with "Sceptic:"');
		expect(prompt).toContain("<council_next>");
	});

	it("builds Joker as a normal active council member", () => {
		const prompt = buildCouncilSystemPrompt({
			enabled: true,
			responseMode: "debate",
			memberIds: ["chair", "joker"],
			activeMemberId: "joker",
			round: 1,
			turn: 2,
		});

		expect(prompt).toContain("Name: Joker");
		expect(prompt).toContain("Role: chaos spark");
		expect(prompt).toContain("Speak only as Joker");
		expect(prompt).toContain("Joker:");
	});

	it("builds a conclusion prompt without routing", () => {
		const prompt = buildCouncilSystemPrompt({
			enabled: true,
			responseMode: "debate",
			phase: "conclusion",
			memberIds: ["chair", "synthesiser"],
			activeMemberId: "synthesiser",
			round: 1,
			turn: 5,
		});

		expect(prompt).toContain("concluding a multi-agent AI council debate");
		expect(prompt).toContain("Name: Synthesiser");
		expect(prompt).toContain("Do not add another routing tag");
		expect(prompt).not.toContain("<council_next>");
	});

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

	it("detects synthetic council turn storage skips", () => {
		expect(shouldSkipCouncilInputStorage({ enabled: true, skipInputStorage: true })).toBe(true);
		expect(shouldSkipCouncilInputStorage({ enabled: true, skipInputStorage: false })).toBe(false);
		expect(shouldSkipCouncilInputStorage({ enabled: false, skipInputStorage: true })).toBe(false);
	});
});
