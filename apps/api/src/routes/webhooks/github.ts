import { Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import {
	getGitHubAppConnectionForInstallation,
	getGitHubAppConnectionForUserInstallation,
} from "~/services/github/connections";
import type { GitHubAppConnection } from "~/services/github/connection-parser";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { validateSignature, extractSandboxCommand } from "~/lib/github";
import {
	executeWebhookSandboxCommand,
	postWebhookSandboxResultComment,
} from "./github-task-execution";

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

	if (event.action !== "created" || !event.comment?.body) {
		return c.json({ success: true });
	}

	const parsedCommand = extractSandboxCommand(event.comment.body);
	if (!parsedCommand) {
		return c.json({ success: true });
	}

	const repo = event.repository?.full_name;
	const issueNumber = event.issue?.number;
	const commenterId = event.comment.user?.id;
	if (!repo || !issueNumber || !commenterId) {
		return c.json({ error: "Missing repository context" }, 400);
	}

	const linkedUser = await serviceContext.repositories.users.getUserByGithubId(
		String(commenterId),
	);

	if (!linkedUser) {
		logger.warn("Ignoring sandbox command from unlinked GitHub user", {
			command: parsedCommand.command,
			github_user_id: commenterId,
			repo,
			issue: issueNumber,
		});
		return c.json({ success: true });
	}

	const linkedUserId = Number((linkedUser as { id?: unknown }).id);
	if (!Number.isFinite(linkedUserId) || linkedUserId <= 0) {
		logger.warn("Ignoring sandbox command for invalid linked user id", {
			command: parsedCommand.command,
			github_user_id: commenterId,
			repo,
			issue: issueNumber,
		});
		return c.json({ success: true });
	}

	try {
		await getGitHubAppConnectionForUserInstallation(
			serviceContext,
			linkedUserId,
			installationId,
		);
	} catch {
		logger.warn(
			"Ignoring sandbox command for installation not linked to user",
			{
				command: parsedCommand.command,
				user_id: linkedUserId,
				installation_id: installationId,
				repo,
				issue: issueNumber,
			},
		);
		return c.json({ success: true });
	}
	const result = await executeWebhookSandboxCommand({
		command: parsedCommand.command,
		repo,
		task: parsedCommand.task,
		installationId,
		env: c.env,
		context: serviceContext,
		user: linkedUser as unknown as IUser,
	});

	try {
		await postWebhookSandboxResultComment({
			command: parsedCommand.command,
			repo,
			issueNumber,
			result,
			connection: {
				appId: githubConnection.appId,
				privateKey: githubConnection.privateKey,
				installationId: githubConnection.installationId,
			},
		});
	} catch (error) {
		logger.error("Failed to post GitHub issue comment", {
			command: parsedCommand.command,
			repo,
			issue: issueNumber,
			error_message: error instanceof Error ? error.message : String(error),
		});
	}

	return c.json({ success: true, response_id: result.responseId });
});

export default github;
