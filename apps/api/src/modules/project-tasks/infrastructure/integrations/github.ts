import { sandboxRepoSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { GitHubTaskClient } from "../GitHubTaskClient";
import type { TaskIntegrationAdapter } from "./types";

const githubAccount = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.number().int().positive());
const githubIssue = z.object({
  provider: z.literal("github"),
  accountId: githubAccount,
  repository: sandboxRepoSchema.transform((value) => value.toLowerCase()),
  issueId: githubAccount,
});
const githubRepository = githubIssue.omit({ issueId: true });

export const githubTaskIntegration: TaskIntegrationAdapter = {
  provider: "github",
  async readIssue(context, _projectId, locator) {
    const parsed = githubIssue.safeParse(locator);

    if (!parsed.success) {
      throw new AssistantError(
        "Use a valid GitHub account, repository and issue number",
        ErrorType.PARAMS_ERROR,
        400,
        { validationErrors: parsed.error.issues },
      );
    }

    const input = parsed.data;
    const client = await GitHubTaskClient.forUser(context, input.accountId, input.repository);
    const issue = await client.readIssue(input.issueId);

    return {
      fields: {
        provider: "github",
        accountId: String(input.accountId),
        connectionId: client.connectionId,
        externalId: String(issue.id),
        identifier: `${client.repository}#${issue.number}`,
        title: issue.title,
        description: issue.body ?? "",
        url: issue.html_url,
      },
      upstreamRevision: issue.updated_at,
    };
  },
  async connectReview(context, locator) {
    const parsed = githubRepository.safeParse(locator);

    if (!parsed.success) {
      throw new AssistantError(
        "Use a valid GitHub account and repository",
        ErrorType.PARAMS_ERROR,
        400,
        { validationErrors: parsed.error.issues },
      );
    }

    const input = parsed.data;

    return GitHubTaskClient.forUser(context, input.accountId, input.repository);
  },
};
