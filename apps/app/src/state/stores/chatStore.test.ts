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
			temporaryChatsDefault: false,
			user: null,
			userSettings: null,
		});
	});

	it("applies temporary chat defaults once when authenticated settings first hydrate", () => {
		const user: User = {
			id: "1",
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
});
