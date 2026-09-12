import {
  SANDBOX_REPOSITORY_ENVIRONMENT_PATH,
  SANDBOX_RUN_PROOF_MAX_CHANGED_FILES,
  isSandboxPullRequestUrl,
  sandboxDeliveryPolicyCreatesCommit,
  sandboxReviewBranchName,
  type SandboxCredentialBrokerAccess,
  type SandboxDeliveryPolicy,
  type SandboxEnvironmentPreparationMode,
  type SandboxEnvironmentSetup,
  type SandboxRunResult,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { safeParseJson } from "~/utils/json";

const hostedSandboxResultSchema = z
  .object({
    summary: z.string().trim().min(1),
    changedFiles: z.array(z.string().trim().min(1)).default([]),
    validation: z
      .array(
        z.object({
          command: z.string().trim().min(1),
          status: z.enum(["passed", "failed"]),
          exitCode: z.number().int().optional(),
          output: z.string().max(12_000).optional(),
        }),
      )
      .default([]),
    residualRisks: z.array(z.string().trim().min(1)).default([]),
    incompleteWork: z.array(z.string().trim().min(1)).default([]),
    branchName: z.string().trim().min(1).optional(),
    commitSha: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{40,64}$/i)
      .optional(),
    pullRequestUrl: z.url().optional(),
  })
  .passthrough();

const HOSTED_SANDBOX_NETWORK_DOMAINS = [
  "registry.npmjs.org",
  "cdn.jsdelivr.net",
  "pypi.org",
  "files.pythonhosted.org",
  "proxy.golang.org",
  "sum.golang.org",
  "crates.io",
  "static.crates.io",
  "rubygems.org",
  "repo.maven.apache.org",
  "services.gradle.org",
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "raw.githubusercontent.com",
  "release-assets.githubusercontent.com",
] as const;

export interface HostedSandboxCommand {
  command: string;
  cwd?: string;
}

export interface HostedSandboxExecutionPlan {
  allowedDomains: string[];
  environment: Record<string, string>;
  setupCommands: HostedSandboxCommand[];
  instructions: string;
  input: string;
}

function deliveryInstruction(policy: SandboxDeliveryPolicy, runId: string): string {
  if (policy.mode === "leave_uncommitted") {
    return "Leave the working tree changes uncommitted and do not push.";
  }

  if (policy.mode === "review_branch") {
    const branch = sandboxReviewBranchName(runId);

    return policy.destination === "pull_request"
      ? `Create branch ${branch}, commit the changes, and push it. Read the default branch from GET $POLYCHAT_BROKER_URL/github/repository, check GET $POLYCHAT_BROKER_URL/github/pulls?state=open&head=<owner>:${encodeURIComponent(branch)}&base=<default>&per_page=1, then create the pull request when needed with POST $POLYCHAT_BROKER_URL/github/pulls and JSON fields title, head, base, and body. Authenticate every broker request with Authorization: Bearer $POLYCHAT_BROKER_GRANT. Do not request or expose a GitHub token.`
      : `Create branch ${branch}, commit the changes, and push it.`;
  }

  if (policy.mode === "commit_to_branch") {
    const stagingBranch = sandboxReviewBranchName(runId);

    return `Check out ${policy.targetBranch} and commit the changes. Push HEAD to refs/heads/${stagingBranch}, then advance ${policy.targetBranch} with POST $POLYCHAT_BROKER_URL/github/deliveries and JSON fields head set to ${stagingBranch} and target set to ${policy.targetBranch}. Authenticate the broker request with Authorization: Bearer $POLYCHAT_BROKER_GRANT. Report ${policy.targetBranch} as branchName. Do not force-push or request a GitHub token.`;
  }

  return policy.instructions;
}

function environmentInstructions(setup?: SandboxEnvironmentSetup): string {
  if (!setup) {
    return "Use the prepared environment.";
  }

  if (setup.source === "repository") {
    return `Read ${SANDBOX_REPOSITORY_ENVIRONMENT_PATH} and follow its declared setup instructions before implementation.`;
  }

  const requirements = [
    ...setup.definition.runtimes.map(
      (runtime) => `${runtime.name}${runtime.version ? ` ${runtime.version}` : ""}`,
    ),
    ...(setup.definition.packageManager
      ? [
          `${setup.definition.packageManager.name}${
            setup.definition.packageManager.version
              ? ` ${setup.definition.packageManager.version}`
              : ""
          }`,
        ]
      : []),
  ];

  return requirements.length > 0
    ? `Use the prepared environment and verify these declared requirements: ${requirements.join(", ")}.`
    : "Use the prepared environment.";
}

function setupCommands(
  setup: SandboxEnvironmentSetup | undefined,
  preparationMode: SandboxEnvironmentPreparationMode | undefined,
): HostedSandboxCommand[] {
  if (!setup || setup.source !== "polychat") {
    return [];
  }

  const commands =
    preparationMode === "resume" && setup.definition.resumeCommands.length > 0
      ? setup.definition.resumeCommands
      : setup.definition.setupCommands;

  return commands.map((command) => ({ command, cwd: "/workspace/repository" }));
}

export function buildHostedSandboxExecutionPlan(params: {
  credentialBroker: SandboxCredentialBrokerAccess;
  repo: string;
  task: string;
  runId: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  environmentSetup?: SandboxEnvironmentSetup;
  environmentPreparationMode?: SandboxEnvironmentPreparationMode;
}): HostedSandboxExecutionPlan {
  return {
    allowedDomains: [
      new URL(params.credentialBroker.baseUrl).hostname,
      ...HOSTED_SANDBOX_NETWORK_DOMAINS,
    ],
    environment: {
      POLYCHAT_BROKER_GRANT: params.credentialBroker.grant,
      POLYCHAT_BROKER_URL: params.credentialBroker.baseUrl,
    },
    setupCommands: [
      {
        command:
          'git -c http.extraHeader="Authorization: Bearer $POLYCHAT_BROKER_GRANT" clone "$POLYCHAT_BROKER_URL/git" /workspace/repository',
      },
      {
        cwd: "/workspace/repository",
        command:
          'git config http."$POLYCHAT_BROKER_URL/git".extraHeader "Authorization: Bearer $POLYCHAT_BROKER_GRANT"',
      },
      {
        cwd: "/workspace/repository",
        command: "git config user.name Polychat && git config user.email work@polychat.app",
      },
      {
        cwd: "/workspace/repository",
        command: "git rev-parse HEAD > /workspace/base-revision",
      },
      ...setupCommands(params.environmentSetup, params.environmentPreparationMode),
    ],
    instructions:
      "Work as a repository coding agent. Inspect before editing, preserve existing conventions, make the requested change, run relevant validation, and follow the supplied delivery policy exactly.",
    input: [
      `Repository: ${params.repo}`,
      `Task: ${params.task}`,
      "Work only in /workspace/repository.",
      environmentInstructions(params.environmentSetup),
      `Delivery policy: ${deliveryInstruction(params.deliveryPolicy, params.runId)}`,
      "Before finishing, run `git add -N .` so untracked files appear in the patch, then write `git diff --binary $(cat /workspace/base-revision)` to /workspace/outputs/diff.patch.",
      "Write /workspace/outputs/result.json as JSON with: summary (string), changedFiles (string array), validation (array of {command,status passed|failed,exitCode?,output?}), residualRisks (string array), incompleteWork (string array), branchName (optional string), commitSha (optional string), and pullRequestUrl (optional URL). Read both output files back to verify them.",
    ].join("\n\n"),
  };
}

function expectedDeliveryBranch(policy: SandboxDeliveryPolicy, runId: string): string | undefined {
  if (policy.mode === "review_branch") {
    return sandboxReviewBranchName(runId);
  }

  return policy.mode === "commit_to_branch" ? policy.targetBranch : undefined;
}

export function buildHostedSandboxRunResult(params: {
  repo: string;
  runId: string;
  resultArtifact?: string;
  diffArtifact?: string;
  outputText: string;
  deliveryPolicy: SandboxDeliveryPolicy;
}): SandboxRunResult {
  const parsed = hostedSandboxResultSchema.safeParse(
    params.resultArtifact ? safeParseJson(params.resultArtifact) : null,
  );

  if (!parsed.success) {
    const reason = "The hosted sandbox did not publish a valid structured result.";

    return {
      success: false,
      summary: params.outputText.trim() || "Hosted sandbox work ended without a valid result.",
      diff: params.diffArtifact,
      logs: params.outputText,
      proof: {
        changedFileCount: 0,
        changedFiles: [],
        validation: { qualityGate: "skipped", checks: [] },
        delivery: { policy: params.deliveryPolicy },
        residualRisks: [reason],
        incompleteWork: [reason],
      },
    };
  }

  const result = parsed.data;
  const expectedBranch = expectedDeliveryBranch(params.deliveryPolicy, params.runId);
  const deliveryProblems: string[] = [];

  if (sandboxDeliveryPolicyCreatesCommit(params.deliveryPolicy)) {
    if (result.branchName !== expectedBranch) {
      deliveryProblems.push("The hosted sandbox did not report the expected delivery branch.");
    }

    if (!result.commitSha) {
      deliveryProblems.push("The hosted sandbox did not report the delivered commit.");
    }
  }

  if (
    params.deliveryPolicy.mode === "review_branch" &&
    params.deliveryPolicy.destination === "pull_request" &&
    (!result.pullRequestUrl || !isSandboxPullRequestUrl(params.repo, result.pullRequestUrl))
  ) {
    deliveryProblems.push("The hosted sandbox did not report a pull request for this repository.");
  }

  const qualityGate = result.validation.some((check) => check.status === "failed")
    ? "failed"
    : result.validation.length > 0
      ? "passed"
      : "skipped";
  const incompleteWork = [...result.incompleteWork, ...deliveryProblems];

  return {
    success: qualityGate !== "failed" && incompleteWork.length === 0,
    summary: result.summary,
    diff: params.diffArtifact,
    logs: params.outputText,
    branchName: result.branchName === expectedBranch ? result.branchName : undefined,
    pullRequestUrl:
      result.pullRequestUrl && isSandboxPullRequestUrl(params.repo, result.pullRequestUrl)
        ? result.pullRequestUrl
        : undefined,
    proof: {
      changedFileCount: result.changedFiles.length,
      changedFiles: result.changedFiles.slice(0, SANDBOX_RUN_PROOF_MAX_CHANGED_FILES),
      validation: { qualityGate, checks: result.validation },
      delivery: {
        policy: params.deliveryPolicy,
        branch: result.branchName === expectedBranch ? result.branchName : undefined,
        commit: result.commitSha,
        pullRequestUrl:
          result.pullRequestUrl && isSandboxPullRequestUrl(params.repo, result.pullRequestUrl)
            ? result.pullRequestUrl
            : undefined,
      },
      residualRisks: [...result.residualRisks, ...deliveryProblems],
      incompleteWork,
    },
  };
}

function addHostedResultProblem(result: SandboxRunResult, problem: string): SandboxRunResult {
  return {
    ...result,
    success: false,
    proof: {
      ...result.proof,
      residualRisks: [...(result.proof?.residualRisks ?? []), problem],
      incompleteWork: [...(result.proof?.incompleteWork ?? []), problem],
    },
  };
}

async function brokerRequest(
  credentialBroker: SandboxCredentialBrokerAccess,
  path: string,
): Promise<Response> {
  return fetch(`${credentialBroker.baseUrl}/github${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${credentialBroker.grant}`,
    },
  });
}

export async function verifyHostedSandboxDelivery(params: {
  result: SandboxRunResult;
  repo: string;
  runId: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  credentialBroker: SandboxCredentialBrokerAccess;
}): Promise<SandboxRunResult> {
  if (!sandboxDeliveryPolicyCreatesCommit(params.deliveryPolicy) || !params.result.success) {
    return params.result;
  }

  const branch = expectedDeliveryBranch(params.deliveryPolicy, params.runId);
  const commit = params.result.proof?.delivery?.commit;

  if (!branch || !commit) {
    return addHostedResultProblem(
      params.result,
      "The hosted sandbox delivery could not be verified.",
    );
  }

  try {
    const branchResponse = await brokerRequest(
      params.credentialBroker,
      `/branches/${encodeURIComponent(branch)}`,
    );

    if (!branchResponse.ok) {
      return addHostedResultProblem(
        params.result,
        `The delivered branch could not be verified (${branchResponse.status}).`,
      );
    }

    const branchPayload = (await branchResponse.json()) as { commit?: { sha?: unknown } };

    if (branchPayload.commit?.sha !== commit) {
      return addHostedResultProblem(
        params.result,
        "The delivered branch does not point to the reported commit.",
      );
    }

    if (
      params.deliveryPolicy.mode !== "review_branch" ||
      params.deliveryPolicy.destination !== "pull_request"
    ) {
      return params.result;
    }

    const repositoryResponse = await brokerRequest(params.credentialBroker, "/repository");

    if (!repositoryResponse.ok) {
      return addHostedResultProblem(
        params.result,
        `The pull request base could not be verified (${repositoryResponse.status}).`,
      );
    }

    const repository = (await repositoryResponse.json()) as { default_branch?: unknown };

    if (typeof repository.default_branch !== "string" || !repository.default_branch.trim()) {
      return addHostedResultProblem(
        params.result,
        "The repository default branch could not be verified.",
      );
    }

    const owner = params.repo.split("/")[0];
    const query = new URLSearchParams({
      state: "open",
      head: `${owner}:${branch}`,
      base: repository.default_branch,
      per_page: "1",
    });
    const pullRequestResponse = await brokerRequest(
      params.credentialBroker,
      `/pulls?${query.toString()}`,
    );

    if (!pullRequestResponse.ok) {
      return addHostedResultProblem(
        params.result,
        `The pull request could not be verified (${pullRequestResponse.status}).`,
      );
    }

    const pullRequests = (await pullRequestResponse.json()) as Array<{ html_url?: unknown }>;
    const pullRequestUrl = pullRequests[0]?.html_url;

    if (
      typeof pullRequestUrl !== "string" ||
      pullRequestUrl !== params.result.pullRequestUrl ||
      !isSandboxPullRequestUrl(params.repo, pullRequestUrl)
    ) {
      return addHostedResultProblem(
        params.result,
        "The reported pull request could not be verified.",
      );
    }

    return params.result;
  } catch {
    return addHostedResultProblem(
      params.result,
      "The hosted sandbox delivery could not be verified.",
    );
  }
}
