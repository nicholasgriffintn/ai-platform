import { type Context, Hono } from "hono";
import { createHmac } from "node:crypto";

import { IEnv } from "../../types";

const github = new Hono();

github.post("/", async (c: Context) => {
	const signature = c.req.header("x-hub-signature-256");
	const payload = await c.req.text();

	const secret = c.env.GITHUB_WEBHOOK_SECRET;
	if (!validateSignature(payload, signature, secret)) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const event = JSON.parse(payload);

	if (
		event.action === "created" &&
		event.comment &&
		event.issue?.pull_request
	) {
		await handlePRComment(event, c.env);
	}

	return c.json({ success: true });
});

async function handlePRComment(event: any, env: IEnv) {
	const comment = event.comment.body;
	const pr = event.issue.number;
	const repo = event.repository.full_name;

	const match = comment.match(/^\/implement\s+(.+)$/m);
	if (!match) return;

	const task = match[1];

	if (!env.SANDBOX_WORKER) return;

	// TODO: Validate user access against the webhook
	// TODO: Get modal from user settings

	const model = "mistral-medium";

	const response = await env.SANDBOX_WORKER.fetch(
		new Request("http://sandbox/execute", {
			method: "POST",
			body: JSON.stringify({
				userId: 1, // System user or mapped user
				taskType: "feature-implementation",
				repo,
				task,
				model,
				polychatApiUrl: "https://api.polychat.app",
				githubPR: pr, // Include PR number for posting results
			}),
		}),
	);

	const result = (await response.json()) as {
		success: boolean;
		summary?: string;
		logs?: string;
		diff?: string;
		error?: string;
	};

	if (result.success) {
		await postCommentToPR(repo, pr, formatResult(result), env.GITHUB_TOKEN);
	}
}

function validateSignature(
	payload: string,
	signature: string | undefined,
	secret: string,
): boolean {
	if (!signature || !secret) return false;
	const hmac = createHmac("sha256", secret);
	const digest = "sha256=" + hmac.update(payload).digest("hex");
	return signature === digest;
}

async function postCommentToPR(
	repo: string,
	pr: number,
	body: string,
	token: string,
) {
	await fetch(`https://api.github.com/repos/${repo}/issues/${pr}/comments`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ body }),
	});
}

function formatResult(result: any): string {
	return (
		`## Implementation Complete\n\n` +
		`${result.summary}\n\n` +
		`<details>\n<summary>Diff</summary>\n\n\`\`\`diff\n${result.diff}\n\`\`\`\n</details>`
	);
}

export default github;
