import { beforeEach, describe, expect, it } from "vitest";

import type { User, UserSettings } from "~/types";
import { useChatStore } from "./chatStore";

describe("chatStore user configuration", () => {
	beforeEach(() => {
		useChatStore.setState({
			currentConversationId: undefined,
			hasApiKey: false,
			hasHydratedUserConfiguration: false,
			isAuthenticated: false,
			isPro: false,
			localOnlyMode: false,
			locallyCreatedConversationIds: {},
			temporaryChatsDefault: false,
			user: null,
			userSettings: null,
		});
	});

	it("applies temporary chat defaults once when authenticated settings first hydrate", () => {
		const user: User = {
			id: 1,
			name: "Nicholas",
			github_username: "nicholas",
			plan_id: "pro",
			avatar_url: "",
			created_at: "2026-06-23T00:00:00.000Z",
			updated_at: "2026-06-23T00:00:00.000Z",
			company: "",
			location: "",
			site: "",
			twitter_username: "",
			github_url: "",
			bio: "",
		};
		const userSettings: UserSettings = {
			id: "settings-1",
			job_role: "",
			nickname: "Nicholas",
			preferences: "",
			traits: "",
			temporary_chats_default: true,
		};

		useChatStore.getState().setAuthenticatedUserConfiguration({
			hasApiKey: true,
			user,
			userSettings,
		});

		expect(useChatStore.getState()).toMatchObject({
			hasHydratedUserConfiguration: true,
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: true,
			temporaryChatsDefault: true,
		});

		useChatStore.getState().setLocalOnlyMode(false);
		useChatStore.getState().setAuthenticatedUserConfiguration({
			hasApiKey: true,
			user,
			userSettings,
		});

		expect(useChatStore.getState().localOnlyMode).toBe(false);
	});

	it("preserves an explicit local-only choice when the first message starts a conversation", () => {
		useChatStore.getState().setLocalOnlyMode(true);

		useChatStore.getState().startNewConversation("conversation-1");

		expect(useChatStore.getState()).toMatchObject({
			currentConversationId: "conversation-1",
			localOnlyMode: true,
		});
	});

	it("preserves an explicit local-only choice when clearing for a new chat", () => {
		useChatStore.setState({ currentConversationId: "conversation-1" });
		useChatStore.getState().setLocalOnlyMode(true);

		useChatStore.getState().clearCurrentConversation();

		expect(useChatStore.getState()).toMatchObject({
			currentConversationId: undefined,
			localOnlyMode: true,
		});
	});
});
