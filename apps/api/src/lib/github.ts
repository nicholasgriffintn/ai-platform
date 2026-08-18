import type { SandboxWebhookCommand } from "@ngriffin_uk/polychat-schemas";

import {
  defaultShouldCommitForSandboxCommand,
  defaultTaskForSandboxCommand,
  extractImplementTask,
  extractSandboxCommand,
  extractSandboxPushCommand,
  getSandboxFunctionName,
} from "./github/command";
import { formatSandboxResultComment, postCommentToIssueOrPullRequest } from "./github/comments";
import { getGitHubAppInstallationToken } from "./github/installation-token";
import {
  parseIssueNumberFromAutomationPayload,
  parseSandboxAutomationCommand,
  parseSandboxShouldCommit,
} from "./github/payload";
import { validateGitHubWebhookSignature } from "./github/signature";

export {
  defaultShouldCommitForSandboxCommand,
  defaultTaskForSandboxCommand,
  extractImplementTask,
  extractSandboxCommand,
  extractSandboxPushCommand,
  getGitHubAppInstallationToken,
  getSandboxFunctionName,
  parseIssueNumberFromAutomationPayload,
  parseSandboxAutomationCommand,
  parseSandboxShouldCommit,
};

export function validateSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  return validateGitHubWebhookSignature({
    payload,
    signature,
    secret,
  });
}

export async function postCommentToPR(
  repo: string,
  pr: number,
  body: string,
  token: string,
): Promise<void> {
  await postCommentToIssueOrPullRequest({
    repo,
    issueOrPrNumber: pr,
    body,
    token,
  });
}

export async function postCommentToIssue(
  repo: string,
  issue: number,
  body: string,
  token: string,
): Promise<void> {
  await postCommentToIssueOrPullRequest({
    repo,
    issueOrPrNumber: issue,
    body,
    token,
  });
}

export function formatResultComment(params: {
  command?: SandboxWebhookCommand;
  success: boolean;
  summary?: string;
  diff?: string;
  error?: string;
  responseId?: string;
}): string {
  return formatSandboxResultComment(params);
}
