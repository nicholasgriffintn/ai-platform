import type { SandboxDeliveryPolicy, SandboxTrustLevel } from "@ngriffin_uk/polychat-schemas";

import type { TaskEvent } from "../types";
import {
  execOrThrow,
  execOrThrowRedacted,
  quoteForShell,
  type SandboxExecInstance,
} from "./commands";
import { resolveCommandApproval } from "./feature-implementation/command-approval";
import { pushBranchToRemote } from "./push-branch";
import type { RunControlClient } from "./run-control-client";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubRepositoryResponse {
  default_branch?: unknown;
}

interface GitHubBranchResponse {
  name?: unknown;
  protected?: unknown;
}

interface GitHubPullRequestResponse {
  html_url?: unknown;
}

async function githubRequest(params: {
  githubToken: string;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<Response> {
  return fetch(`${GITHUB_API_BASE}${params.path}`, {
    method: params.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${params.githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "Polychat-Sandbox",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
}

function repositoryPath(repo: string): string {
  const [owner, name] = repo.split("/");

  if (!owner || !name) {
    throw new Error("Repository must be in owner/repository format");
  }

  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

async function readJson<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${errorMessage} (GitHub returned ${response.status})`);
  }

  return response.json<T>();
}

export async function getDefaultBranch(params: {
  repo: string;
  githubToken: string;
}): Promise<string> {
  const response = await githubRequest({
    githubToken: params.githubToken,
    path: repositoryPath(params.repo),
  });
  const payload = await readJson<GitHubRepositoryResponse>(
    response,
    "Could not verify the repository delivery target",
  );

  if (typeof payload.default_branch !== "string" || !payload.default_branch.trim()) {
    throw new Error("GitHub did not return the repository default branch");
  }

  return payload.default_branch.trim();
}

export async function assertDirectBranchIsWritable(params: {
  repo: string;
  targetBranch: string;
  defaultBranch: string;
  githubToken: string;
}): Promise<void> {
  if (params.targetBranch.toLowerCase() === "main") {
    throw new Error("Direct delivery cannot target main");
  }

  if (params.targetBranch === params.defaultBranch) {
    throw new Error("Direct delivery cannot target the repository default branch");
  }

  const response = await githubRequest({
    githubToken: params.githubToken,
    path: `${repositoryPath(params.repo)}/branches/${encodeURIComponent(params.targetBranch)}`,
  });
  const branch = await readJson<GitHubBranchResponse>(
    response,
    "Could not verify the configured delivery branch",
  );

  if (branch.protected !== false) {
    throw new Error("Direct delivery requires an existing non-protected branch");
  }
}

export async function prepareDeliveryBranch(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  runId: string;
  policy: SandboxDeliveryPolicy;
  checkoutAuthHeader?: string;
  executionLogs: string[];
}): Promise<string | undefined> {
  if (params.policy.mode === "leave_uncommitted" || params.policy.mode === "custom") {
    return undefined;
  }

  if (params.policy.mode === "review_branch") {
    const branchName = `polychat/run-${params.runId}`;

    await execOrThrow(
      params.sandbox,
      `git -C ${quoteForShell(params.repoTargetDir)} checkout -B ${quoteForShell(branchName)}`,
      params.executionLogs,
    );

    return branchName;
  }

  const fetchCommand = `git -C ${quoteForShell(params.repoTargetDir)} fetch origin ${quoteForShell(params.policy.targetBranch)} --depth=1`;

  if (params.checkoutAuthHeader) {
    await execOrThrowRedacted(
      params.sandbox,
      `git -c http.extraHeader=${quoteForShell(params.checkoutAuthHeader)} -C ${quoteForShell(params.repoTargetDir)} fetch origin ${quoteForShell(params.policy.targetBranch)} --depth=1`,
      params.executionLogs,
      `${fetchCommand} [auth header redacted]`,
    );
  } else {
    await execOrThrow(params.sandbox, fetchCommand, params.executionLogs);
  }

  await execOrThrow(
    params.sandbox,
    `git -C ${quoteForShell(params.repoTargetDir)} checkout -B ${quoteForShell(params.policy.targetBranch)} FETCH_HEAD`,
    params.executionLogs,
  );

  return params.policy.targetBranch;
}

export async function prepareGitHubDelivery(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  repo: string;
  runId: string;
  policy: SandboxDeliveryPolicy;
  githubToken: string;
  checkoutAuthHeader?: string;
  executionLogs: string[];
}): Promise<{ branchName: string; targetBranch: string; defaultBranch?: string }> {
  let defaultBranch: string | undefined;

  if (
    params.policy.mode === "commit_to_branch" ||
    (params.policy.mode === "review_branch" && params.policy.destination === "pull_request")
  ) {
    defaultBranch = await getDefaultBranch({
      repo: params.repo,
      githubToken: params.githubToken,
    });
  }

  if (params.policy.mode === "commit_to_branch") {
    if (!defaultBranch) {
      throw new Error("Direct delivery requires the repository default branch");
    }

    await assertDirectBranchIsWritable({
      repo: params.repo,
      targetBranch: params.policy.targetBranch,
      defaultBranch,
      githubToken: params.githubToken,
    });
  }

  const branchName = await prepareDeliveryBranch(params);

  if (!branchName) {
    throw new Error("The selected policy does not create a GitHub delivery branch");
  }

  const targetBranch =
    params.policy.mode === "commit_to_branch"
      ? params.policy.targetBranch
      : params.policy.mode === "review_branch" && params.policy.destination === "pull_request"
        ? defaultBranch
        : branchName;

  if (!targetBranch) {
    throw new Error("GitHub delivery target could not be resolved");
  }

  return { branchName, targetBranch, defaultBranch };
}

async function findOpenPullRequest(params: {
  repo: string;
  branchName: string;
  baseBranch: string;
  githubToken: string;
}): Promise<string | undefined> {
  const owner = params.repo.split("/")[0];
  const query = new URLSearchParams({
    state: "open",
    head: `${owner}:${params.branchName}`,
    base: params.baseBranch,
    per_page: "1",
  });
  const response = await githubRequest({
    githubToken: params.githubToken,
    path: `${repositoryPath(params.repo)}/pulls?${query.toString()}`,
  });
  const payload = await readJson<GitHubPullRequestResponse[]>(
    response,
    "Could not check for an existing pull request",
  );
  const url = payload[0]?.html_url;

  return typeof url === "string" && url.startsWith("https://github.com/") ? url : undefined;
}

export async function createOrFindPullRequest(params: {
  repo: string;
  branchName: string;
  baseBranch: string;
  runId: string;
  validationSummary: string;
  githubToken: string;
}): Promise<string> {
  const existing = await findOpenPullRequest(params);

  if (existing) {
    return existing;
  }

  const response = await githubRequest({
    githubToken: params.githubToken,
    path: `${repositoryPath(params.repo)}/pulls`,
    method: "POST",
    body: {
      title: `Polychat coding run ${params.runId}`,
      head: params.branchName,
      base: params.baseBranch,
      body: `Prepared by Polychat coding run ${params.runId}.\n\nValidation: ${params.validationSummary}`,
    },
  });

  if (response.status === 422) {
    const raced = await findOpenPullRequest(params);

    if (raced) {
      return raced;
    }
  }

  const pullRequest = await readJson<GitHubPullRequestResponse>(
    response,
    "GitHub could not create the pull request",
  );

  if (
    typeof pullRequest.html_url !== "string" ||
    !pullRequest.html_url.startsWith("https://github.com/")
  ) {
    throw new Error("GitHub did not return a valid pull request URL");
  }

  return pullRequest.html_url;
}

export function formatDeliveryApproval(params: {
  repo: string;
  policy: SandboxDeliveryPolicy;
  branchName: string;
  targetBranch: string;
  commitSha: string;
  validationSummary: string;
}): string {
  const action =
    params.policy.mode === "review_branch" && params.policy.destination === "pull_request"
      ? "Push review branch and open pull request"
      : params.policy.mode === "review_branch"
        ? "Push review branch"
        : "Push commit to configured branch";

  return [
    `Repository: ${params.repo}`,
    `Action: ${action}`,
    `Branch: ${params.branchName}`,
    `Target: ${params.targetBranch}`,
    `Commit: ${params.commitSha}`,
    `Validation: ${params.validationSummary.replace(/\s+/g, " ").slice(0, 200)}`,
  ].join("\n");
}

export async function deliverCommitToGitHub(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  repo: string;
  runId: string;
  policy: SandboxDeliveryPolicy;
  branchName: string;
  targetBranch: string;
  defaultBranch?: string;
  commitSha: string;
  validationSummary: string;
  githubToken: string;
  checkoutAuthHeader?: string;
  executionLogs: string[];
  trustLevel: SandboxTrustLevel;
  approvalClient?: RunControlClient;
  abortSignal?: AbortSignal;
  checkpoint: (abortMessage: string) => Promise<void>;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<{ pullRequestUrl?: string; incompleteReason?: string }> {
  const approval = await resolveCommandApproval({
    command: formatDeliveryApproval(params),
    riskLevel: "network",
    trustLevel: params.trustLevel,
    agentStep: 0,
    emit: params.emit,
    approvalClient: params.approvalClient,
    abortSignal: params.abortSignal,
    guardExecution: params.checkpoint,
    alwaysRequireApproval: true,
  });

  if (approval.rejected) {
    const incompleteReason = approval.rejectedMessage ?? "GitHub delivery was not approved";

    await params.emit({
      type: "delivery_skipped",
      branchName: params.branchName,
      commitSha: params.commitSha,
      targetBranch: params.targetBranch,
      deliveryAction: params.policy.mode,
      message: incompleteReason,
    });

    return { incompleteReason };
  }

  try {
    if (params.policy.mode === "commit_to_branch") {
      if (!params.defaultBranch) {
        throw new Error("Direct delivery requires the repository default branch");
      }

      await assertDirectBranchIsWritable({
        repo: params.repo,
        targetBranch: params.targetBranch,
        defaultBranch: params.defaultBranch,
        githubToken: params.githubToken,
      });
    }

    await params.emit({
      type: "delivery_started",
      branchName: params.branchName,
      commitSha: params.commitSha,
      targetBranch: params.targetBranch,
      deliveryAction: params.policy.mode,
    });
    await pushBranchToRemote({
      sandbox: params.sandbox,
      repoTargetDir: params.repoTargetDir,
      branchName: params.branchName,
      checkoutAuthHeader: params.checkoutAuthHeader,
      executionLogs: params.executionLogs,
      checkpoint: params.checkpoint,
      emit: params.emit,
    });

    let pullRequestUrl: string | undefined;

    if (params.policy.mode === "review_branch" && params.policy.destination === "pull_request") {
      if (!params.defaultBranch) {
        throw new Error("Pull request delivery requires the repository default branch");
      }

      pullRequestUrl = await createOrFindPullRequest({
        repo: params.repo,
        branchName: params.branchName,
        baseBranch: params.defaultBranch,
        runId: params.runId,
        validationSummary: params.validationSummary,
        githubToken: params.githubToken,
      });
    }

    await params.emit({
      type: "delivery_completed",
      branchName: params.branchName,
      commitSha: params.commitSha,
      targetBranch: params.targetBranch,
      deliveryAction: params.policy.mode,
      pullRequestUrl,
    });

    return { pullRequestUrl };
  } catch (error) {
    await params.emit({
      type: "delivery_failed",
      branchName: params.branchName,
      commitSha: params.commitSha,
      targetBranch: params.targetBranch,
      deliveryAction: params.policy.mode,
      error: error instanceof Error ? error.message : "GitHub delivery failed",
    });

    throw error;
  }
}
