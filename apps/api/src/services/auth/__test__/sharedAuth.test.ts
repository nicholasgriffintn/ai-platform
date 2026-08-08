import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

const useAuthPlugin = vi.hoisted(() => vi.fn());
const createAuth = vi.hoisted(() => vi.fn(() => ({ use: useAuthPlugin })));
const createGitHubAuth = vi.hoisted(() => vi.fn(() => ({ provider: "github" })));

vi.mock("@ngriffin_uk/auth-core", () => ({
	createAuth,
	isRecord: (value: unknown) =>
		typeof value === "object" && value !== null && !Array.isArray(value),
}));

vi.mock("@ngriffin_uk/auth-provider-github", () => ({ createGitHubAuth }));

import { createAssistantGitHubAuth } from "~/services/auth/sharedAuth";

describe("Assistant GitHub authentication", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses the configured public API URL for the OAuth callback", () => {
		createAssistantGitHubAuth({
			env: {
				API_BASE_URL: "http://localhost:8787",
				GITHUB_CLIENT_ID: "client-id",
				GITHUB_CLIENT_SECRET: "client-secret",
			},
			repositories: {
				authChallenges: {},
				oauthStates: {},
				sessions: {},
				users: {},
			},
		} as ServiceContext);

		expect(createGitHubAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				redirectUri: "http://localhost:8787/auth/github/callback",
			}),
		);
	});

	it("reports missing GitHub settings as a configuration error", () => {
		expect(() =>
			createAssistantGitHubAuth({
				env: { API_BASE_URL: "https://api.polychat.app" },
			} as ServiceContext),
		).toThrowError(AssistantError);
	});
});
