import { describe, expect, it } from "vitest";

import { createChatWelcome } from "./chat-welcome";

describe("createChatWelcome", () => {
	it("offers whimsical copy without personal context", () => {
		expect(createChatWelcome({ hasPreviousChats: false }, 0)).toEqual({
			title: "What’s on your mind?",
			description: "Bring a question, a rough idea, or something you want to work through.",
		});
	});

	it("recognises a returning chat user", () => {
		expect(createChatWelcome({ hasPreviousChats: true }, 0)).toEqual({
			title: "What’s still buzzing?",
			description: "A problem, a possibility, or the thought that wouldn’t leave.",
		});
	});

	it("prefers the chosen nickname over the account name", () => {
		const welcome = createChatWelcome(
			{
				preferredName: "Nick",
				accountName: "Nicholas Griffin",
				hasPreviousChats: true,
			},
			0,
		);

		expect(welcome.title).toBe("Where to next, Nick?");
	});

	it("uses the first account name when no nickname is set", () => {
		const welcome = createChatWelcome(
			{
				accountName: "Nicholas Griffin",
				hasPreviousChats: false,
			},
			0,
		);

		expect(welcome.title).toBe("A blank page, Nicholas.");
	});

	it("can tailor the invitation to a broad work context", () => {
		const welcome = createChatWelcome(
			{
				preferredName: "Nick",
				jobRole: "Senior Software Engineer",
				hasPreviousChats: true,
			},
			0.2,
		);

		expect(welcome).toEqual({
			title: "What are we taking apart, Nick?",
			description: "Code knot, system puzzle, or the suspiciously simple thing that isn’t.",
		});
	});

	it("keeps general welcome copy in rotation for role-matched users", () => {
		const welcome = createChatWelcome(
			{
				preferredName: "Nick",
				jobRole: "Senior Software Engineer",
				hasPreviousChats: true,
			},
			0.8,
		);

		expect(welcome.title).toBe("What’s still buzzing, Nick?");
	});

	it("gives students their own practical framing", () => {
		const welcome = createChatWelcome(
			{
				preferredName: "Sam",
				jobRole: "Student",
				hasPreviousChats: true,
			},
			0,
		);

		expect(welcome).toEqual({
			title: "What are we working through, Sam?",
			description: "An essay, a difficult concept, or the next step in an assignment.",
		});
	});
});
