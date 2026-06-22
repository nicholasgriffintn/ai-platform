import { describe, expect, it } from "vitest";

import {
	MEMORY_SEARCH_TOOL_NAME,
	MEMORY_STORE_TOOL_NAME,
	buildMemoryPromptContext,
	mergeEnabledMemoryToolNames,
	resolveMemoryPolicy,
} from "../memoryPolicy";
import type { IUser } from "~/types";

function createUser(planId: string | null): IUser {
	return {
		id: 1,
		name: null,
		avatar_url: null,
		email: "user@example.com",
		github_username: null,
		company: null,
		site: null,
		location: null,
		bio: null,
		twitter_username: null,
		created_at: "2026-06-22T00:00:00.000Z",
		updated_at: "2026-06-22T00:00:00.000Z",
		setup_at: null,
		terms_accepted_at: null,
		plan_id: planId,
	};
}

describe("resolveMemoryPolicy", () => {
	it("enables retrieval and storage only for pro users with memory settings and stored conversations", () => {
		expect(
			resolveMemoryPolicy({
				user: createUser("pro"),
				userSettings: {
					memories_save_enabled: true,
					memories_chat_history_enabled: true,
				},
				store: true,
			}),
		).toEqual({
			enabled: true,
			canRetrieve: true,
			canStore: true,
			toolNames: [MEMORY_SEARCH_TOOL_NAME, MEMORY_STORE_TOOL_NAME],
		});

		expect(
			resolveMemoryPolicy({
				user: createUser("pro"),
				userSettings: {
					memories_save_enabled: true,
					memories_chat_history_enabled: true,
				},
				store: false,
			}).enabled,
		).toBe(false);

		expect(
			resolveMemoryPolicy({
				user: createUser("free"),
				userSettings: {
					memories_save_enabled: true,
				},
				store: true,
			}).enabled,
		).toBe(false);
	});

	it("exposes search for chat-history memories and store only for save-enabled memories", () => {
		expect(
			resolveMemoryPolicy({
				user: createUser("pro"),
				userSettings: {
					memories_save_enabled: false,
					memories_chat_history_enabled: true,
				},
				store: true,
			}).toolNames,
		).toEqual([MEMORY_SEARCH_TOOL_NAME]);

		expect(
			mergeEnabledMemoryToolNames({
				enabledTools: ["web_search", MEMORY_SEARCH_TOOL_NAME],
				user: createUser("pro"),
				userSettings: {
					memories_save_enabled: true,
					memories_chat_history_enabled: false,
				},
				store: true,
			}),
		).toEqual(["web_search", MEMORY_SEARCH_TOOL_NAME, MEMORY_STORE_TOOL_NAME]);
	});
});

describe("buildMemoryPromptContext", () => {
	it("formats synthesis and relevant memories in a stable prompt block", () => {
		expect(
			buildMemoryPromptContext({
				synthesisText: "Prefers concise answers.",
				recentMemories: [
					{ text: "Uses Neovim.", score: 0.8 },
					{ text: "Works in London.", score: 0.7 },
				],
			}),
		).toBe(
			[
				"",
				"",
				"# Memory Summary",
				"The following is a consolidated summary of your long-term memories about this user:",
				"<memory_synthesis>",
				"Prefers concise answers.",
				"</memory_synthesis>",
				"",
				"# Recently Relevant Memories",
				"The following specific memories are most relevant to this conversation:",
				"<recent_memories>",
				"- Uses Neovim.",
				"- Works in London.",
				"</recent_memories>",
			].join("\n"),
		);
	});
});
