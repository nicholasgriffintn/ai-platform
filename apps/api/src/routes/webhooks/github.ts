import { Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import { executeDynamicApp } from "~/services/dynamic-apps";
import { getGitHubAppConnectionForInstallation } from "~/services/github/connections";
import type { GitHubAppConnection } from "~/services/github/connection-parser";
import type { IRequest, IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
	validateSignature,
	postCommentToPR,
	formatResultComment,
	extractImplementTask,
	getGitHubAppInstallationToken,
} from "~/lib/github";

const github = new Hono<{ Bindings: IEnv }>();
const logger = getLogger({ prefix: "routes/webhooks/github" });

interface GithubIssueCommentEvent {
	action?: string;
	installation?: {
		id?: number;
	};
	comment?: {
		body?: string;
		user?: {
			id?: number;
			login?: string;
		};
	};
	issue?: {
		number?: number;
		pull_request?: unknown;
	};
	repository?: {
		full_name?: string;
	};
}

github.post("/", async (c) => {
	const signature = c.req.header("x-hub-signature-256");
	const payload = await c.req.text();

	let event: GithubIssueCommentEvent;
	try {
		event = JSON.parse(payload) as GithubIssueCommentEvent;
	} catch {
		return c.json({ error: "Invalid JSON payload" }, 400);
	}

	const installationId = event.installation?.id;
	if (!installationId || !Number.isFinite(installationId)) {
		return c.json({ error: "Missing installation context" }, 400);
	}

	const serviceContext = getServiceContext(c);
	let githubConnection: GitHubAppConnection;
	try {
		githubConnection = await getGitHubAppConnectionForInstallation(
			serviceContext,
			installationId,
		);
	} catch {
		return c.json({ error: "GitHub App connection not found" }, 401);
	}

	if (!githubConnection.webhookSecret) {
		return c.json({ error: "GitHub webhook secret not configured" }, 503);
	}

	if (!validateSignature(payload, signature, githubConnection.webhookSecret)) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const eventType = c.req.header("x-github-event");
	if (eventType !== "issue_comment") {
		return c.json({ success: true });
	}

	if (
		event.action !== "created" ||
		!event.issue?.pull_request ||
		!event.comment?.body
	) {
		return c.json({ success: true });
	}

	const task = extractImplementTask(event.comment.body);
	if (!task) {
		return c.json({ success: true });
	}

	const repo = event.repository?.full_name;
	const prNumber = event.issue.number;
	const commenterId = event.comment.user?.id;
	if (!repo || !prNumber || !commenterId) {
		return c.json({ error: "Missing repository context" }, 400);
	}

	let githubInstallationToken: string;
	try {
		githubInstallationToken = await getGitHubAppInstallationToken({
			appId: githubConnection.appId,
			privateKey: githubConnection.privateKey,
			installationId: githubConnection.installationId,
		});
	} catch (error) {
		logger.error("Failed to resolve GitHub App installation token", {
			repo,
			pr: prNumber,
			installation_id: installationId,
			error_message: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{ error: "GitHub App connection is not configured for this repository" },
			503,
		);
	}

	const linkedUser = await serviceContext.repositories.users.getUserByGithubId(
		String(commenterId),
	);

	if (!linkedUser) {
		logger.warn("Ignoring /implement command from unlinked GitHub user", {
			github_user_id: commenterId,
			repo,
			pr: prNumber,
		});
		return c.json({ success: true });
	}

	const req: IRequest = {
		app_url: c.env.APP_BASE_URL || "https://polychat.app",
		env: c.env,
		user: linkedUser as unknown as IUser,
		context: serviceContext,
		request: {
			completion_id: generateId(),
			input: "dynamic-app-execution",
			date: new Date().toISOString(),
			platform: "dynamic-apps",
		},
	};

	let execution: Record<string, any>;
	try {
		execution = await executeDynamicApp(
			"run_feature_implementation",
			{
				repo,
				task,
			},
			req,
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Unknown sandbox execution error";
		logger.error("Failed to execute sandbox task from GitHub webhook", {
			repo,
			pr: prNumber,
			error_message: errorMessage,
		});

		try {
			await postCommentToPR(
				repo,
				prNumber,
				formatResultComment({
					success: false,
					error: errorMessage,
				}),
				githubInstallationToken,
			);
		} catch (commentError) {
			logger.error("Failed to post GitHub PR failure comment", {
				repo,
				pr: prNumber,
				error_message:
					commentError instanceof Error
						? commentError.message
						: String(commentError),
			});
		}

		return c.json({ success: true });
	}

	const result = (execution.data?.result ?? {}) as {
		success?: boolean;
		summary?: string;
		diff?: string;
		error?: string;
	};

	const body = formatResultComment({
		success: Boolean(result.success),
		summary: result.summary,
		diff: result.diff,
		error: result.error,
		responseId: execution.response_id,
	});

	try {
		await postCommentToPR(repo, prNumber, body, githubInstallationToken);
	} catch (error) {
		logger.error("Failed to post GitHub PR comment", {
			repo,
			pr: prNumber,
			error_message: error instanceof Error ? error.message : String(error),
		});
	}

	return c.json({ success: true, response_id: execution.response_id });
});

export default github;
