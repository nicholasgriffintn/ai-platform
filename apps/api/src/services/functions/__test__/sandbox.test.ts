import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateJwtToken } from "~/services/auth/jwt";
import { getGitHubAppInstallationToken } from "~/lib/github";
import { getGitHubAppConnectionForUserRepo } from "~/services/github/connections";
import type { IRequest } from "~/types";
import { run_feature_implementation } from "../sandbox";

vi.mock("~/services/auth/jwt", () => ({
	generateJwtToken: vi.fn(),
}));
vi.mock("~/lib/github", () => ({
	getGitHubAppInstallationToken: vi.fn(),
}));
vi.mock("~/services/github/connections", () => ({
	getGitHubAppConnectionForUserRepo: vi.fn(),
}));

describe("run_feature_implementation", () => {
	const sandboxFetch = vi.fn();
	const getUserSettings = vi.fn();

	const request: IRequest = {
		env: {
			ENV: "production",
			API_BASE_URL: "https://api.polychat.app",
			JWT_SECRET: "secret",
			SANDBOX_WORKER: {
				fetch: sandboxFetch,
			},
		} as any,
		user: {
			id: 42,
		} as any,
		context: {
			env: {
				JWT_SECRET: "secret",
			},
			repositories: {
				userSettings: {
					getUserSettings,
				},
			},
		} as any,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(generateJwtToken).mockResolvedValue("sandbox-jwt");
		vi.mocked(getGitHubAppConnectionForUserRepo).mockResolvedValue({
			appId: "123456",
			privateKey: "private-key",
			installationId: 78910,
		});
		vi.mocked(getGitHubAppInstallationToken).mockResolvedValue(
			"github-app-token",
		);
	});

	it("passes selected model and GitHub token to sandbox worker", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		sandboxFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({
				success: true,
				summary: "done",
				logs: "logs",
				diff: "diff",
			}),
		});

		const result = await run_feature_implementation.function(
			"completion-id",
			{
				repo: "owner/repo",
				task: "Add tests",
				shouldCommit: true,
			},
			request,
		);

		expect(generateJwtToken).toHaveBeenCalledWith(
			request.user,
			request.env.JWT_SECRET,
			60 * 60,
		);
		expect(sandboxFetch).toHaveBeenCalledTimes(1);

		const workerRequest = sandboxFetch.mock.calls[0][0] as Request;
		const workerBody = JSON.parse(await workerRequest.text());

		expect(workerBody).toMatchObject({
			userId: 42,
			taskType: "feature-implementation",
			repo: "owner/repo",
			task: "Add tests",
			model: "mistral-large",
			shouldCommit: true,
		});
		expect(workerRequest.headers.get("Authorization")).toBe(
			"Bearer sandbox-jwt",
		);
		expect(workerRequest.headers.get("X-GitHub-Token")).toBe(
			"github-app-token",
		);
		expect(result).toMatchObject({
			success: true,
			summary: "done",
			logs: "logs",
			diff: "diff",
		});
	});

	it("requests a GitHub App installation token for the target repo", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		sandboxFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({
				success: true,
			}),
		});

		await run_feature_implementation.function(
			"completion-id",
			{
				repo: "owner/repo",
				task: "Add tests",
			},
			request,
		);

		const workerRequest = sandboxFetch.mock.calls[0][0] as Request;
		const workerBody = JSON.parse(await workerRequest.text());

		expect(getGitHubAppConnectionForUserRepo).toHaveBeenCalledWith(
			request.context,
			42,
			"owner/repo",
		);
		expect(getGitHubAppInstallationToken).toHaveBeenCalledWith({
			appId: "123456",
			privateKey: "private-key",
			installationId: 78910,
		});
		expect(workerBody.githubToken).toBeUndefined();
		expect(workerBody.userToken).toBeUndefined();
		expect(workerRequest.headers.get("Authorization")).toBe(
			"Bearer sandbox-jwt",
		);
		expect(workerRequest.headers.get("X-GitHub-Token")).toBe(
			"github-app-token",
		);
	});

	it("falls back to default model when no model and no sandbox setting are provided", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: null });
		sandboxFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({
				success: true,
				summary: "done",
			}),
		});

		await run_feature_implementation.function(
			"completion-id",
			{
				repo: "owner/repo",
				task: "Add tests",
			},
			request,
		);

		const workerRequest = sandboxFetch.mock.calls[0][0] as Request;
		const workerBody = JSON.parse(await workerRequest.text());
		expect(workerBody.model).toBe("mistral-large");
	});

	it("throws when sandbox worker responds with a non-2xx status", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		sandboxFetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: vi.fn().mockResolvedValue("sandbox failed"),
		});

		await expect(
			run_feature_implementation.function(
				"completion-id",
				{
					repo: "owner/repo",
					task: "Add tests",
				},
				request,
			),
		).rejects.toThrow("Sandbox worker error (500): sandbox failed");
	});

	it("throws when GitHub App token creation fails", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		vi.mocked(getGitHubAppInstallationToken).mockRejectedValueOnce(
			new Error("No GitHub App installation found for owner/repo"),
		);

		await expect(
			run_feature_implementation.function(
				"completion-id",
				{
					repo: "owner/repo",
					task: "Add tests",
				},
				request,
			),
		).rejects.toThrow("No GitHub App installation found for owner/repo");
	});
});
