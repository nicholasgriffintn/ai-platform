import { describe, expect, it } from "vitest";

import { returnCouncilPrompt } from "../council";

describe("returnCouncilPrompt", () => {
	it("returns an empty prompt when council mode is not enabled", () => {
		expect(returnCouncilPrompt(undefined)).toBe("");
		expect(returnCouncilPrompt({ enabled: false })).toBe("");
	});

	it("builds a prompt with selected council personalities", () => {
		const prompt = returnCouncilPrompt({
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
		const prompt = returnCouncilPrompt({
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
		const prompt = returnCouncilPrompt({
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
		const prompt = returnCouncilPrompt({
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
});
