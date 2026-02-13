import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateJwtToken } from "~/services/auth/jwt";
import { getGitHubAppInstallationToken } from "~/lib/github";
import {
	getGitHubAppConnectionForUserInstallation,
	getGitHubAppConnectionForUserRepo,
} from "~/services/github/connections";

const SANDBOX_TOKEN_EXPIRATION_SECONDS = 60 * 60;

export interface ExecuteSandboxWorkerOptions {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	repo: string;
	task: string;
	model?: string;
	taskType?: string;
	shouldCommit?: boolean;
	installationId?: number;
	stream?: boolean;
	runId?: string;
	githubTokenOverride?: string;
	apiBaseUrl?: string;
}

export function resolveApiBaseUrl(
	env: IEnv,
	requestUrl?: string,
	fallback?: string,
): string {
	if (fallback?.trim()) {
		return fallback.trim();
	}
	if (env.API_BASE_URL?.trim()) {
		return env.API_BASE_URL.trim();
	}
	if (requestUrl) {
		try {
			return new URL(requestUrl).origin;
		} catch {
			// Ignore parse errors and use environment fallback.
		}
	}

	return env.ENV === "production"
		? "https://api.polychat.app"
		: "http://localhost:8787";
}

export async function resolveSandboxModel(params: {
	context: ServiceContext;
	userId: number;
	model?: string;
}): Promise<string> {
	const { context, userId, model } = params;

	if (model?.trim()) {
		return model.trim();
	}

	const settings =
		await context.repositories.userSettings.getUserSettings(userId);
	if (settings?.sandbox_model?.trim()) {
		return settings.sandbox_model.trim();
	}

	throw new AssistantError(
		"No model specified. Provide a model or configure one in settings.",
		ErrorType.PARAMS_ERROR,
	);
}

async function resolveGitHubToken(params: {
	context: ServiceContext;
	userId: number;
	repo: string;
	installationId?: number;
	githubTokenOverride?: string;
}): Promise<string> {
	const { context, userId, repo, installationId, githubTokenOverride } = params;

	if (githubTokenOverride?.trim()) {
		return githubTokenOverride.trim();
	}

	const githubConnection = installationId
		? await getGitHubAppConnectionForUserInstallation(
				context,
				userId,
				installationId,
			)
		: await getGitHubAppConnectionForUserRepo(context, userId, repo);

	return getGitHubAppInstallationToken({
		appId: githubConnection.appId,
		privateKey: githubConnection.privateKey,
		installationId: githubConnection.installationId,
	});
}

export async function executeSandboxWorker(
	options: ExecuteSandboxWorkerOptions,
): Promise<Response> {
	const {
		env,
		context,
		user,
		repo,
		task,
		taskType,
		shouldCommit,
		installationId,
		stream,
		runId,
		githubTokenOverride,
		apiBaseUrl,
	} = options;

	if (!env.SANDBOX_WORKER) {
		throw new AssistantError(
			"Sandbox worker not available",
			ErrorType.NOT_FOUND,
		);
	}
	if (!env.JWT_SECRET) {
		throw new AssistantError(
			"JWT secret not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const model = await resolveSandboxModel({
		context,
		userId: user.id,
		model: options.model,
	});
	const sandboxToken = await generateJwtToken(
		user,
		env.JWT_SECRET,
		SANDBOX_TOKEN_EXPIRATION_SECONDS,
	);

	const githubToken = await resolveGitHubToken({
		context,
		userId: user.id,
		repo,
		installationId,
		githubTokenOverride,
	});

	const response = await env.SANDBOX_WORKER.fetch(
		new Request("http://sandbox/execute", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${sandboxToken}`,
				"X-GitHub-Token": githubToken,
				...(stream ? { Accept: "text/event-stream" } : {}),
			},
			body: JSON.stringify({
				userId: user.id,
				taskType: taskType || "feature-implementation",
				repo,
				task,
				model,
				shouldCommit: Boolean(shouldCommit),
				polychatApiUrl: resolveApiBaseUrl(env, undefined, apiBaseUrl),
				installationId,
				runId,
			}),
		}),
	);

	return response;
}
