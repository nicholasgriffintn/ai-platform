import type { SandboxWebhookCommand } from "@assistant/schemas";

import {
	defaultShouldCommitForSandboxCommand,
	defaultTaskForSandboxCommand,
	formatResultComment,
	getGitHubAppInstallationToken,
	getSandboxDynamicAppId,
	postCommentToIssue,
} from "~/lib/github";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { executeDynamicApp } from "~/services/dynamic-apps";
import type { IEnv, IRequest, IUser } from "~/types";
import { generateId } from "~/utils/id";

interface GitHubConnectionCredentials {
	appId: string;
	privateKey: string;
	installationId: number;
}

export interface SandboxExecutionResult {
	success: boolean;
	summary?: string;
	diff?: string;
	error?: string;
	responseId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildRequest(params: {
	env: IEnv;
	user: IUser;
	context: ServiceContext;
}): IRequest {
	return {
		app_url: params.env.APP_BASE_URL || "https://polychat.app",
		env: params.env,
		user: params.user,
		context: params.context,
		request: {
			completion_id: generateId(),
			input: "dynamic-app-execution",
			date: new Date().toISOString(),
			platform: "dynamic-apps",
		},
	};
}

export async function executeWebhookSandboxCommand(params: {
	command: SandboxWebhookCommand;
	repo: string;
	task: string;
	installationId: number;
	shouldCommit?: boolean;
	env: IEnv;
	context: ServiceContext;
	user: IUser;
}): Promise<SandboxExecutionResult> {
	const {
		command,
		repo,
		task,
		installationId,
		shouldCommit,
		env,
		context,
		user,
	} = params;

	const appId = getSandboxDynamicAppId(command);
	const finalTask = task.trim() || defaultTaskForSandboxCommand(command);
	const finalShouldCommit =
		shouldCommit ?? defaultShouldCommitForSandboxCommand(command);
	const payload: Record<string, unknown> = {
		repo,
		task: finalTask,
		installationId,
	};

	if (command === "implement" || command === "fix") {
		payload.shouldCommit = finalShouldCommit;
	}

	try {
		const execution = await executeDynamicApp(appId, payload, {
			...buildRequest({ env, context, user }),
		});

		const responseId =
			typeof execution.response_id === "string"
				? execution.response_id
				: undefined;
		const resultRecord = isRecord(execution.data?.result)
			? execution.data.result
			: {};

		return {
			success:
				typeof resultRecord.success === "boolean" ? resultRecord.success : true,
			summary:
				typeof resultRecord.summary === "string"
					? resultRecord.summary
					: undefined,
			diff:
				typeof resultRecord.diff === "string" ? resultRecord.diff : undefined,
			error:
				typeof resultRecord.error === "string" ? resultRecord.error : undefined,
			responseId,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown sandbox execution error",
		};
	}
}

export async function postWebhookSandboxResultComment(params: {
	command: SandboxWebhookCommand;
	repo: string;
	issueNumber: number;
	result: SandboxExecutionResult;
	connection: GitHubConnectionCredentials;
}): Promise<void> {
	const token = await getGitHubAppInstallationToken({
		appId: params.connection.appId,
		privateKey: params.connection.privateKey,
		installationId: params.connection.installationId,
	});

	await postCommentToIssue(
		params.repo,
		params.issueNumber,
		formatResultComment({
			command: params.command,
			success: params.result.success,
			summary: params.result.summary,
			diff: params.result.diff,
			error: params.result.error,
			responseId: params.result.responseId,
		}),
		token,
	);
}
