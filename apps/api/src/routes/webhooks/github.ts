import { Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import { executeDynamicApp } from "~/services/dynamic-apps";
import type { IRequest, IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
	validateSignature,
	postCommentToPR,
	formatResultComment,
	extractImplementTask,
} from "~/lib/github";

const github = new Hono<{ Bindings: IEnv }>();
const logger = getLogger({ prefix: "routes/webhooks/github" });

interface GithubIssueCommentEvent {
	action?: string;
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
	// TODO: This really needs to come from a GitHub app that the user has configured.
	const secret = c.env.GITHUB_WEBHOOK_SECRET;
	if (!secret) {
		return c.json({ error: "Webhook secret not configured" }, 503);
	}

	const signature = c.req.header("x-hub-signature-256");
	const payload = await c.req.text();

	if (!validateSignature(payload, signature, secret)) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const eventType = c.req.header("x-github-event");
	if (eventType !== "issue_comment") {
		return c.json({ success: true });
	}

	let event: GithubIssueCommentEvent;
	try {
		event = JSON.parse(payload) as GithubIssueCommentEvent;
	} catch {
		return c.json({ error: "Invalid JSON payload" }, 400);
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

	const serviceContext = getServiceContext(c);
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

		// TODO: This should again come from a GitHub app that the user has configured, rather than a global token.
		if (c.env.GITHUB_TOKEN) {
			try {
				await postCommentToPR(
					repo,
					prNumber,
					formatResultComment({
						success: false,
						error: errorMessage,
					}),
					c.env.GITHUB_TOKEN,
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
		}

		return c.json({ success: true });
	}

	const result = (execution.data?.result ?? {}) as {
		success?: boolean;
		summary?: string;
		diff?: string;
		error?: string;
	};

	if (c.env.GITHUB_TOKEN) {
		const body = formatResultComment({
			success: Boolean(result.success),
			summary: result.summary,
			diff: result.diff,
			error: result.error,
			responseId: execution.response_id,
		});

		try {
			await postCommentToPR(repo, prNumber, body, c.env.GITHUB_TOKEN);
		} catch (error) {
			logger.error("Failed to post GitHub PR comment", {
				repo,
				pr: prNumber,
				error_message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return c.json({ success: true, response_id: execution.response_id });
});

export default github;
