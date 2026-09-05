import { getSandbox } from "@cloudflare/sandbox";
import {
  SANDBOX_RUN_PROOF_MAX_CHANGED_FILES,
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  type SandboxEnvironmentCacheRecord,
  type SandboxRunEnvironmentEvidence,
  type SandboxRunServiceEvidence,
  type SandboxRunProofEvidence,
  type SandboxDeliveryPolicy,
} from "@ngriffin_uk/polychat-schemas";

import {
  execOrThrow,
  execOrThrowRedacted,
  resolveGitHubRepo,
  buildSummary,
  truncateLog,
  quoteForShell,
  buildCommitMessage,
} from "../../lib/commands";
import { prepareSandboxEnvironment } from "../../lib/environment-setup";
import { classifySandboxError } from "../../lib/errors";
import { createExecutionControl } from "../../lib/execution-control";
import { executeAgentLoop } from "../../lib/feature-implementation/agent-loop";
import {
  DEFAULT_MODEL,
  MAX_COMMANDS,
  MODEL_RETRY_OPTIONS,
} from "../../lib/feature-implementation/constants";
import { collectRepositoryContext } from "../../lib/feature-implementation/context";
import { startFileWatcher, type FileWatcher } from "../../lib/feature-implementation/file-watcher";
import { resolvePromptStrategy } from "../../lib/feature-implementation/prompt-strategy";
import { buildPlanningPrompt } from "../../lib/feature-implementation/prompts";
import {
  deriveQualityGateCommands,
  runQualityGate,
} from "../../lib/feature-implementation/quality-gate";
import { runStoryTracker } from "../../lib/feature-implementation/story-tracker";
import { truncateForModel } from "../../lib/feature-implementation/utils";
import { deliverCommitToGitHub, prepareGitHubDelivery } from "../../lib/github-delivery";
import { PolychatClient } from "../../lib/polychat-client";
import { RunControlClient } from "../../lib/run-control-client";
import { ProjectServiceSupervisor } from "../../lib/service-supervisor";
import type {
  TaskEvent,
  TaskEventEmitter,
  TaskParams,
  TaskResult,
  TaskSecrets,
  Env,
} from "../../types";

function lines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function buildProofEvidence(params: {
  baseRevision?: string;
  headRevision?: string;
  changedFiles: string[];
  validation?: SandboxRunProofEvidence["validation"];
  environment?: SandboxRunEnvironmentEvidence;
  services?: SandboxRunServiceEvidence[];
  deliveryPolicy?: SandboxDeliveryPolicy;
  branch?: string;
  commit?: string;
  pullRequestUrl?: string;
  residualRisks?: string[];
  incompleteWork?: string[];
}): SandboxRunProofEvidence {
  return {
    repository: {
      baseRevision: params.baseRevision,
      headRevision: params.headRevision,
    },
    changedFileCount: params.changedFiles.length,
    changedFiles: params.changedFiles.slice(0, SANDBOX_RUN_PROOF_MAX_CHANGED_FILES),
    validation: params.validation,
    environment: params.environment,
    services: params.services,
    delivery: {
      policy: params.deliveryPolicy,
      branch: params.branch,
      commit: params.commit,
      pullRequestUrl: params.pullRequestUrl,
    },
    residualRisks: params.residualRisks,
    incompleteWork: params.incompleteWork,
  };
}

function resolveAbsoluteRepoTargetDir(sandboxRoot: string, repoTargetDir: string): string {
  if (repoTargetDir.startsWith("/")) {
    return repoTargetDir;
  }

  return `${sandboxRoot.replace(/\/+$/, "")}/${repoTargetDir.replace(/^\/+/, "")}`;
}

export async function executeFeatureImplementation(
  params: TaskParams,
  secrets: TaskSecrets,
  env: Env,
  emitEvent?: TaskEventEmitter,
  abortSignal?: AbortSignal,
): Promise<TaskResult> {
  const emit = async (event: TaskEvent) => {
    if (!emitEvent) {
      return;
    }

    const nextEvent: TaskEvent = {
      ...event,
      type: event.type,
      runId: typeof event.runId === "string" ? event.runId : runId,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    await emitEvent(nextEvent);
  };

  if (!env.POLYCHAT_API) {
    throw new Error("POLYCHAT_API service binding is required");
  }

  const runId = params.runId || crypto.randomUUID().slice(0, 8);
  const deliveryPolicy = resolveSandboxDeliveryPolicy(params.deliveryPolicy, params.shouldCommit);
  const shouldCommit = sandboxDeliveryPolicyCreatesCommit(deliveryPolicy);
  const sandbox = getSandbox(env.Sandbox, runId);
  const client = new PolychatClient(secrets.userToken, env.POLYCHAT_API);
  const executionLogs: string[] = [];
  let branchName: string | undefined;
  let baseRevision: string | undefined;
  let headRevision: string | undefined;
  let commitSha: string | undefined;
  let defaultBranch: string | undefined;
  let targetBranch: string | undefined;
  let pullRequestUrl: string | undefined;
  let deliveryIncompleteReason: string | undefined;
  let changedFiles: string[] = [];
  let validation: SandboxRunProofEvidence["validation"];
  let environmentEvidence: SandboxRunEnvironmentEvidence | undefined;
  let environmentCacheRecord: SandboxEnvironmentCacheRecord | undefined;
  let serviceSupervisor: ProjectServiceSupervisor | undefined;
  let serviceFailure: Promise<never> | undefined;
  let fileWatcher: FileWatcher | undefined;

  const executionControl = createExecutionControl({
    runId,
    timeoutSeconds: params.timeoutSeconds,
    userToken: secrets.userToken,
    apiService: env.POLYCHAT_API,
    abortSignal,
    emitEvent,
  });
  const approvalClient = params.runId
    ? new RunControlClient({
        userToken: secrets.userToken,
        runId: params.runId,
        apiService: env.POLYCHAT_API,
      })
    : undefined;
  const checkpoint = (abortMessage: string) => executionControl.checkpoint(abortMessage);

  try {
    await checkpoint("Sandbox run cancelled before task start");

    await emit({
      type: "task_started",
      task: params.task,
      repo: params.repo,
      model: params.model || DEFAULT_MODEL,
      trustLevel: params.trustLevel ?? "balanced",
      installationId: params.installationId,
      polychatUri: params.polychatApiUrl,
    });

    const task = params.task.trim();

    if (!task) {
      throw new Error("Task is required");
    }

    const taskType = params.taskType || "feature-implementation";

    const model = params.model || DEFAULT_MODEL;
    const repo = resolveGitHubRepo(params.repo, secrets.githubToken);

    await checkpoint("Sandbox run cancelled before repository clone");
    await emit({
      type: "repo_clone_started",
      repo: repo.displayName,
      installationId: params.installationId,
    });

    if (repo.checkoutAuthHeader) {
      await execOrThrowRedacted(
        sandbox,
        `git -c http.extraHeader=${quoteForShell(repo.checkoutAuthHeader)} clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)}`,
        executionLogs,
        `git clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)} [auth header redacted]`,
      );
    } else {
      await sandbox.gitCheckout(repo.checkoutUrl, {
        targetDir: repo.targetDir,
        depth: 1,
      });
    }

    await emit({
      type: "repo_clone_completed",
      repo: repo.displayName,
      targetDir: repo.targetDir,
    });

    const sandboxRootResult = await sandbox.exec("pwd");

    if (!sandboxRootResult.success) {
      throw new Error(sandboxRootResult.stderr || "Failed to resolve sandbox working directory");
    }

    const sandboxRoot = lines(sandboxRootResult.stdout).at(-1);

    if (!sandboxRoot) {
      throw new Error("Failed to resolve sandbox working directory");
    }

    const repoTargetDir = resolveAbsoluteRepoTargetDir(sandboxRoot, repo.targetDir);
    const baseRevisionResult = await sandbox.exec(
      `git -C ${quoteForShell(repoTargetDir)} rev-parse HEAD`,
    );

    if (baseRevisionResult.success) {
      baseRevision = baseRevisionResult.stdout.trim() || undefined;
      headRevision = baseRevision;
    }

    await checkpoint("Sandbox run cancelled after repository clone");

    const environmentPreparation = await prepareSandboxEnvironment({
      sandbox,
      repoTargetDir,
      userId: params.userId,
      projectId: params.projectId,
      installationId: params.installationId,
      repo: params.repo,
      setup: params.environmentSetup,
      requestedMode: params.environmentPreparationMode,
      environmentCache: params.environmentCache,
      environmentCacheGeneration: params.environmentCacheGeneration,
      trustLevel: params.trustLevel ?? "balanced",
      executionLogs,
      approvalClient,
      abortSignal,
      checkpoint,
      emit,
    });

    environmentEvidence = environmentPreparation.evidence;
    environmentCacheRecord = environmentPreparation.cacheRecord;

    fileWatcher = startFileWatcher({
      sandbox,
      watchPath: repoTargetDir,
      emit,
      abortSignal,
    });

    if (environmentPreparation.services?.length) {
      serviceSupervisor = new ProjectServiceSupervisor({
        sandbox,
        repoTargetDir,
        services: environmentPreparation.services,
        trustLevel: params.trustLevel ?? "balanced",
        approvalClient,
        abortSignal,
        checkpoint,
        emit,
      });
      await serviceSupervisor.start();
      serviceFailure = serviceSupervisor.waitForFailure();
    }

    const supervisedAbortSignal = serviceSupervisor
      ? abortSignal
        ? AbortSignal.any([abortSignal, serviceSupervisor.signal])
        : serviceSupervisor.signal
      : abortSignal;

    if (shouldCommit) {
      if (!secrets.githubToken) {
        throw new Error("GitHub delivery requires a current installation token");
      }

      const delivery = await prepareGitHubDelivery({
        sandbox,
        repoTargetDir,
        repo: repo.displayName,
        runId,
        policy: deliveryPolicy,
        githubToken: secrets.githubToken,
        checkoutAuthHeader: repo.checkoutAuthHeader,
        executionLogs,
      });

      branchName = delivery.branchName;
      targetBranch = delivery.targetBranch;
      defaultBranch = delivery.defaultBranch;

      await emit({
        type: "git_branch_created",
        branchName,
        targetBranch,
        deliveryAction: deliveryPolicy.mode,
      });
    }

    const repoContext = await collectRepositoryContext({
      sandbox,
      repoTargetDir,
    });

    await checkpoint("Sandbox run cancelled while collecting repository context");
    await emit({
      type: "repo_context_collected",
      message: `Collected repository context from ${repoContext.files.length} files`,
      taskInstructionSource: repoContext.taskInstructionSource,
      hasTaskInstructions: Boolean(repoContext.taskInstructions),
      hasPrdInstructions: repoContext.taskInstructionSource === "prd",
    });

    const promptStrategy = resolvePromptStrategy({
      requestedStrategy: params.promptStrategy,
      taskType,
      task,
    });

    await emit({
      type: "prompt_strategy_selected",
      message: promptStrategy.reason,
      promptStrategy: promptStrategy.strategy,
    });

    await emit({
      type: "planning_started",
      message: "Creating implementation plan",
    });

    const planResponse = await client.chatCompletion(
      {
        messages: [
          {
            role: "user",
            content: buildPlanningPrompt({
              repoName: repo.displayName,
              task,
              repoContext,
              promptStrategy,
            }),
          },
        ],
        model,
        ...params.modelSettings,
      },
      MODEL_RETRY_OPTIONS,
    );
    const plan = planResponse.content;

    await checkpoint("Sandbox run cancelled during planning");

    await emit({
      type: "planning_completed",
      plan: truncateForModel(plan, 4000),
    });
    await emit({
      type: "command_batch_ready",
      commandTotal: MAX_COMMANDS,
      message: "Agent command budget initialised",
    });

    const loopOperation = executeAgentLoop({
      sandbox,
      client,
      model,
      modelSettings: params.modelSettings,
      repoDisplayName: repo.displayName,
      repoTargetDir,
      task,
      taskType,
      promptStrategy,
      trustLevel: params.trustLevel,
      initialPlan: plan,
      repoContext,
      executionLogs,
      emit,
      approvalClient,
      abortSignal: supervisedAbortSignal,
      checkpoint,
    });
    const loopResult = serviceFailure
      ? await Promise.race([loopOperation, serviceFailure])
      : await loopOperation;

    serviceSupervisor?.throwIfFailed();

    const qualityGateCommands = deriveQualityGateCommands({
      plans: [loopResult.finalPlan, plan],
    });

    await emit({
      type: "quality_gate_commands_selected",
      commandTotal: qualityGateCommands.length,
      commands: qualityGateCommands,
    });
    const qualityGateOperation = runQualityGate({
      sandbox,
      repoTargetDir,
      commands: qualityGateCommands,
      executionLogs,
      emit,
      abortSignal: supervisedAbortSignal,
      checkpoint,
    });
    const qualityGateResult = serviceFailure
      ? await Promise.race([qualityGateOperation, serviceFailure])
      : await qualityGateOperation;

    serviceSupervisor?.throwIfFailed();

    validation = {
      qualityGate:
        qualityGateCommands.length === 0
          ? "skipped"
          : qualityGateResult.passed
            ? "passed"
            : "failed",
      checks: qualityGateResult.checks.map((check) => ({
        command: check.command,
        status: check.passed ? "passed" : "failed",
        exitCode: check.exitCode,
      })),
    };

    await checkpoint("Sandbox run cancelled after quality gate");

    const storyTrackerResult = await runStoryTracker({
      sandbox,
      repoTargetDir,
      prdContext: repoContext.prdContext,
      task,
      plan: loopResult.finalPlan,
      qualityGatePassed: qualityGateResult.passed,
      qualityGateSummary: qualityGateResult.summary,
      emit,
    });

    await checkpoint("Sandbox run cancelled during story tracking");
    serviceSupervisor?.throwIfFailed();

    const diffResult = await sandbox.exec(`git -C ${quoteForShell(repoTargetDir)} diff --patch`);

    await checkpoint("Sandbox run cancelled during diff generation");
    if (!diffResult.success) {
      throw new Error(diffResult.stderr || "Failed to generate git diff");
    }

    const diff = diffResult.stdout;
    const changedFilesResult = await sandbox.exec(
      `git -C ${quoteForShell(repoTargetDir)} ls-files --modified --others --exclude-standard`,
    );

    if (changedFilesResult.success) {
      changedFiles = lines(changedFilesResult.stdout);
    }

    await emit({
      type: "diff_generated",
      hasChanges: diff.trim().length > 0,
    });
    serviceSupervisor?.throwIfFailed();

    if (shouldCommit && qualityGateResult.passed) {
      await checkpoint("Sandbox run cancelled before commit");
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repoTargetDir)} config user.name ${quoteForShell("Polychat Bot")}`,
        executionLogs,
      );
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repoTargetDir)} config user.email ${quoteForShell("bot@polychat.app")}`,
        executionLogs,
      );
      await execOrThrow(sandbox, `git -C ${quoteForShell(repoTargetDir)} add -A`, executionLogs);

      const stagedStatus = await sandbox.exec(
        `git -C ${quoteForShell(repoTargetDir)} diff --cached --quiet`,
      );

      await checkpoint("Sandbox run cancelled before commit");
      if (stagedStatus.exitCode !== 0) {
        await execOrThrow(
          sandbox,
          `git -C ${quoteForShell(repoTargetDir)} commit -m ${quoteForShell(buildCommitMessage(task))}`,
          executionLogs,
        );
        const commitResult = await sandbox.exec(
          `git -C ${quoteForShell(repoTargetDir)} rev-parse HEAD`,
        );

        if (commitResult.success) {
          commitSha = commitResult.stdout.trim() || undefined;
          headRevision = commitSha ?? headRevision;
        }

        if (!branchName || !targetBranch || !commitSha || !secrets.githubToken) {
          throw new Error("Delivery evidence is incomplete; no GitHub write was attempted");
        }

        await emit({
          type: "commit_created",
          branchName,
          commitSha,
          targetBranch,
          deliveryAction: deliveryPolicy.mode,
        });

        const delivery = await deliverCommitToGitHub({
          sandbox,
          repoTargetDir,
          repo: repo.displayName,
          runId,
          policy: deliveryPolicy,
          branchName,
          targetBranch,
          defaultBranch,
          commitSha,
          validationSummary: qualityGateResult.summary,
          githubToken: secrets.githubToken,
          checkoutAuthHeader: repo.checkoutAuthHeader,
          executionLogs,
          trustLevel: params.trustLevel ?? "balanced",
          approvalClient,
          abortSignal,
          checkpoint,
          emit,
        });

        pullRequestUrl = delivery.pullRequestUrl;
        deliveryIncompleteReason = delivery.incompleteReason;
      }
    } else if (shouldCommit && !qualityGateResult.passed) {
      deliveryIncompleteReason = "Delivery was skipped because the quality gate failed.";
      await emit({
        type: "commit_skipped",
        deliveryAction: deliveryPolicy.mode,
        message: deliveryIncompleteReason,
      });
    }

    const summary = [
      loopResult.summary ||
        buildSummary(task, repo.displayName, loopResult.commandCount, branchName, taskType),
      qualityGateResult.summary,
      storyTrackerResult.summary,
      deliveryIncompleteReason,
    ]
      .filter(Boolean)
      .join(" ");

    serviceSupervisor?.throwIfFailed();

    return {
      success: true,
      logs: truncateLog(executionLogs.join("\n")),
      diff,
      branchName,
      pullRequestUrl,
      summary,
      environmentCache: environmentCacheRecord,
      proof: buildProofEvidence({
        baseRevision,
        headRevision,
        changedFiles,
        validation,
        environment: environmentEvidence,
        services: serviceSupervisor?.getEvidence(),
        deliveryPolicy,
        branch: branchName,
        commit: commitSha,
        pullRequestUrl,
        residualRisks: qualityGateResult.passed ? [] : [qualityGateResult.summary],
        incompleteWork: deliveryIncompleteReason ? [deliveryIncompleteReason] : [],
      }),
    };
  } catch (error) {
    console.error("Error during sandbox task execution:", error);
    const classified = classifySandboxError(error);

    await emit({
      type: classified.type === "cancelled" ? "task_cancelled" : "task_failed",
      error: classified.message,
      errorType: classified.type,
      retryable: classified.retryable,
    });

    return {
      success: false,
      logs: truncateLog(executionLogs.join("\n")),
      branchName,
      pullRequestUrl,
      error: classified.message,
      errorType: classified.type,
      retryable: classified.retryable,
      environmentCache: environmentCacheRecord,
      proof: buildProofEvidence({
        baseRevision,
        headRevision,
        changedFiles,
        validation,
        environment: environmentEvidence,
        services: serviceSupervisor?.getEvidence(),
        deliveryPolicy,
        branch: branchName,
        commit: commitSha,
        pullRequestUrl,
        residualRisks: [classified.message],
        incompleteWork: ["The run ended before the objective was completed."],
      }),
    };
  } finally {
    fileWatcher?.stop();
    await serviceSupervisor?.stop();
    await sandbox.destroy();
  }
}
