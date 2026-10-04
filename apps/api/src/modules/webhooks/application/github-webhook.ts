import { sandboxRepoSchema, gitCommitShaSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { validateSignature } from "~/infrastructure/github";
import { getGitHubAppConnectionForInstallation } from "~/modules/github/application/connections";
import { enqueueGithubReviewIntake } from "~/modules/project-tasks/application/review-intake";

import { processGithubComment } from "./github-comment-intake";

const installationSchema = z.object({
  installation: z.object({ id: z.number().int().positive() }),
});
const sha = gitCommitShaSchema;
const prEventSchema = installationSchema.extend({
  action: z.string(),
  repository: z.object({
    id: z.number().int().positive(),
    full_name: sandboxRepoSchema.transform((value) => value.toLowerCase()),
  }),
  pull_request: z.object({
    number: z.number().int().positive(),
    draft: z.boolean(),
    state: z.string(),
    base: z.object({ sha }),
    head: z.object({ sha }),
  }),
});

interface WebhookResult {
  status: 200 | 400 | 401 | 503;
  body: Record<string, unknown>;
}

export async function handleGithubWebhook(params: {
  context: ServiceContext;
  payload: string;
  signature?: string;
  eventType?: string;
}): Promise<WebhookResult> {
  const raw = safeParseJson<unknown>(params.payload);
  const parsed = installationSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: 400, body: { error: "Invalid payload or installation context" } };
  }

  const connection = await getGitHubAppConnectionForInstallation(
    params.context,
    parsed.data.installation.id,
  ).catch(() => null);

  if (!connection) {
    return { status: 401, body: { error: "GitHub App connection not found" } };
  }

  if (!connection.webhookSecret) {
    return { status: 503, body: { error: "GitHub webhook secret not configured" } };
  }

  if (!validateSignature(params.payload, params.signature, connection.webhookSecret)) {
    return { status: 401, body: { error: "Invalid signature" } };
  }

  if (params.eventType === "issue_comment") {
    return { status: 200, body: await processGithubComment(params.context, raw) };
  }

  if (params.eventType === "pull_request") {
    const event = prEventSchema.safeParse(raw);

    if (!event.success) {
      return { status: 400, body: { error: "Invalid PR event" } };
    }

    const data = event.data;

    if (
      ["opened", "synchronize", "reopened", "ready_for_review"].includes(data.action) &&
      !data.pull_request.draft &&
      data.pull_request.state === "open"
    ) {
      await enqueueGithubReviewIntake(params.context, {
        installationId: data.installation.id,
        repository: data.repository.full_name,
        repositoryId: data.repository.id,
        pullRequestNumber: data.pull_request.number,
        baseSha: data.pull_request.base.sha,
        headSha: data.pull_request.head.sha,
      });
    }
  }

  return { status: 200, body: { success: true } };
}
