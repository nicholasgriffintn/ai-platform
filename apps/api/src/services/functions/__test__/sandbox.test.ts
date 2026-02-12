import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateJwtToken } from "~/services/auth/jwt";
import type { IRequest } from "~/types";
import { run_feature_implementation } from "../sandbox";

vi.mock("~/services/auth/jwt", () => ({
	generateJwtToken: vi.fn(),
}));

describe("run_feature_implementation", () => {
	const sandboxFetch = vi.fn();
	const getUserSettings = vi.fn();
	const getProviderApiKey = vi.fn();

	const request: IRequest = {
		env: {
			ENV: "production",
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
					getProviderApiKey,
				},
			},
		} as any,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(generateJwtToken).mockResolvedValue("sandbox-jwt");
	});

	it("passes selected model and GitHub token to sandbox worker", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		getProviderApiKey
			.mockResolvedValueOnce("github-token")
			.mockResolvedValue(null);
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
			request.context?.env.JWT_SECRET,
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
			userToken: "sandbox-jwt",
			shouldCommit: true,
			githubToken: "github-token",
		});
		expect(result).toMatchObject({
			success: true,
			summary: "done",
			logs: "logs",
			diff: "diff",
		});
	});

	it("falls back across GitHub provider ids", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		getProviderApiKey
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce("copilot-token")
			.mockResolvedValueOnce(null);
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

		expect(getProviderApiKey).toHaveBeenCalledWith(42, "github-models");
		expect(getProviderApiKey).toHaveBeenCalledWith(42, "github-copilot");
		expect(workerBody.githubToken).toBe("copilot-token");
	});

	it("throws when no model is provided and no sandbox model is configured", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: null });

		await expect(
			run_feature_implementation.function(
				"completion-id",
				{
					repo: "owner/repo",
					task: "Add tests",
				},
				request,
			),
		).rejects.toThrow(
			"No model specified. Provide a model or configure one in settings.",
		);
	});

	it("throws when sandbox worker responds with a non-2xx status", async () => {
		getUserSettings.mockResolvedValue({ sandbox_model: "mistral-large" });
		getProviderApiKey.mockResolvedValueOnce(null);
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
});
