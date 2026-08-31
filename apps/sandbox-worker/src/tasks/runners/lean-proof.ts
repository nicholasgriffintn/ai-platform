import { getSandbox } from "@cloudflare/sandbox";
import {
  AgentTokenBudgetExceededError,
  executeAgentLoop,
  parseToolCallArguments,
  type AgentMessage,
  type AgentLoopState,
  type AgentTokenUsage,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";
import type { LeanProofResult } from "@ngriffin_uk/polychat-schemas";

import {
  buildCommitMessage,
  execOrThrow,
  execOrThrowRedacted,
  quoteForShell,
  resolveGitHubRepo,
  truncateLog,
} from "../../lib/commands";
import { classifySandboxError } from "../../lib/errors";
import { createExecutionControl } from "../../lib/execution-control";
import { buildLeanProofBranchName } from "../../lib/lean-proof/branch";
import {
  assertLeanReplacementFileLimits,
  assertLeanTargetFileLimits,
} from "../../lib/lean-proof/file-limits";
import { normaliseLeanProofSummary } from "../../lib/lean-proof/summary";
import { resolveLeanMaxOutputTokens } from "../../lib/lean-proof/token-budget";
import {
  LEAN_CHECK_TOOL,
  LEAN_PROOF_TOOLS,
  LEAN_READ_FILE_TOOL,
  LEAN_LSP_DIAGNOSTICS_TOOL,
  LEAN_REPLACE_TOOL,
  LEAN_SEARCH_TOOL,
  parseLeanReadArgs,
  parseLeanLspArgs,
  parseLeanReplaceArgs,
  parseLeanSearchArgs,
} from "../../lib/lean-proof/tools";
import { validateLeanProof, type LeanValidationResult } from "../../lib/lean-proof/validation";
import { PolychatClient } from "../../lib/polychat-client";
import { pushBranchToRemote } from "../../lib/push-branch";
import type {
  Env,
  TaskEvent,
  TaskEventEmitter,
  TaskParams,
  TaskResult,
  TaskSecrets,
} from "../../types";

const LEANSTRAL_MODEL = "labs-leanstral-1-5";
const DEFAULT_TOKEN_BUDGET = 400_000;
const MAX_AGENT_STEPS = 36;
const MAX_CONTEXT_CHARS = 120_000;
const RETAINED_CONTEXT_MESSAGES = 24;

interface LeanAgentState extends AgentLoopState {
  commandCount: number;
  usage: AgentTokenUsage;
  latestValidation?: LeanValidationResult;
}

function emptyUsage(): AgentTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    iterations: 0,
  };
}

function textContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return value === null || value === undefined ? "" : JSON.stringify(value);
}

function compactLeanMessages(messages: AgentMessage[], currentPlan: string): AgentMessage[] | void {
  const size = messages.reduce((total, message) => total + textContent(message.content).length, 0);

  if (size <= MAX_CONTEXT_CHARS || messages.length <= RETAINED_CONTEXT_MESSAGES + 2) {
    return;
  }

  let boundary = Math.max(2, messages.length - RETAINED_CONTEXT_MESSAGES);

  while (boundary > 2 && messages[boundary]?.role === "tool") {
    boundary -= 1;
  }

  return [
    messages[0],
    messages[1],
    {
      role: "developer",
      content: [
        "Earlier proof work was compacted to keep the run within its context window.",
        `Current plan: ${currentPlan}`,
        "Trust only compiler and axiom-audit observations in the retained transcript.",
      ].join("\n"),
    },
    ...messages.slice(boundary),
  ];
}

function assertRequestedTarget(path: string, targetPaths: readonly string[]): string {
  if (!targetPaths.includes(path)) {
    throw new Error(`Tool access is restricted to requested Lean targets: ${path}`);
  }

  return path;
}

function toolResult(call: AgentToolCall, content: string, status = "success"): AgentMessage {
  return {
    role: "tool",
    name: call.name,
    tool_call_id: call.id,
    tool_call_arguments: call.arguments,
    content,
    status,
  };
}

function buildSystemPrompt(repositoryRoot: string, targetPaths: readonly string[]): string {
  return [
    "You are a Lean 4 proof engineer running inside an isolated repository checkout.",
    `Repository root: ${repositoryRoot}`,
    `Editable targets: ${targetPaths.join(", ")}`,
    "Use only the supplied bounded file, search, exact replacement, and compiler tools.",
    "Never claim success from reasoning alone. Run check_lean_targets after edits.",
    "Do not introduce sorry, admit, axioms, unsafe, partial, extern, or implemented_by.",
    "Call finish only after the compiler accepts every target.",
  ].join("\n");
}

function buildKickoffPrompt(params: TaskParams): string {
  const request = params.leanProof;

  return [
    `Objective: ${request?.objective ?? params.task}`,
    request?.acceptanceCriteria.length
      ? `Acceptance criteria:\n${request.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`
      : "",
    request?.declarations.length
      ? `Declarations to audit:\n${request.declarations.map((item) => `- ${item}`).join("\n")}`
      : "No declarations were supplied for the stricter axiom audit; a successful run will be reported as compiled.",
    "Inspect the targets, plan the smallest proof change, compile it, and finish with a concise evidence-based summary.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function assertLeanRepositoryPreflight(params: {
  sandbox: ReturnType<typeof getSandbox>;
  repositoryRoot: string;
  targetPaths: readonly string[];
  logs: string[];
}) {
  const toolchain = await params.sandbox.exec(
    `test -f ${quoteForShell(`${params.repositoryRoot}/lean-toolchain`)}`,
  );

  if (!toolchain.success) {
    throw new Error("Lean proof runs require a checked-in lean-toolchain file");
  }

  const lakefileLean = await params.sandbox.exec(
    `test -f ${quoteForShell(`${params.repositoryRoot}/lakefile.lean`)}`,
  );
  const lakefileToml = await params.sandbox.exec(
    `test -f ${quoteForShell(`${params.repositoryRoot}/lakefile.toml`)}`,
  );

  if (!lakefileLean.success && !lakefileToml.success) {
    throw new Error("Lean proof runs require lakefile.lean or lakefile.toml");
  }

  await assertLeanTargetFileLimits({
    sandbox: params.sandbox,
    repositoryRoot: params.repositoryRoot,
    targetPaths: params.targetPaths,
  });

  await execOrThrow(
    params.sandbox,
    `cd ${quoteForShell(params.repositoryRoot)} && lake --version`,
    params.logs,
  );
}

async function executeLeanAgent(params: {
  taskParams: TaskParams;
  sandbox: ReturnType<typeof getSandbox>;
  repositoryRoot: string;
  client: PolychatClient;
  emit: (event: TaskEvent) => Promise<void>;
  checkpoint: (message: string) => Promise<void>;
  state: LeanAgentState;
  abortSignal?: AbortSignal;
}) {
  const request = params.taskParams.leanProof;

  if (!request) {
    throw new Error("Lean proof runner requires a leanProof request");
  }

  const messages: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt(params.repositoryRoot, request.targetPaths) },
    { role: "user", content: buildKickoffPrompt(params.taskParams) },
  ];
  const tokenBudget = params.taskParams.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  return executeAgentLoop({
    initialMessages: messages,
    initialPlan: "Inspect targets, make a minimal proof edit, compile, and audit declarations.",
    shared: {},
    state: params.state,
    config: { maxSteps: MAX_AGENT_STEPS, maxConsecutiveTurnFailures: 3 },
    tokenBudget,
    guardExecution: params.checkpoint,
    emit: params.emit,
    compactMessages: ({ messages: currentMessages, currentPlan }) =>
      compactLeanMessages(currentMessages, currentPlan),
    buildSummary: ({ summary }) => normaliseLeanProofSummary(summary),
    onTokenUsage: async (usage) => {
      params.state.usage = usage;
      await params.emit({ type: "lean_proof_usage", usage });
    },
    resolveTurn: async ({ messages: currentMessages, step, usage, remainingTokenBudget }) => {
      const maxTokens = resolveLeanMaxOutputTokens({
        messages: currentMessages,
        tools: LEAN_PROOF_TOOLS,
        usage,
        remainingTokenBudget: remainingTokenBudget ?? tokenBudget,
        requestedMaxOutputTokens: params.taskParams.modelSettings?.max_tokens,
        tokenBudget,
      });
      const completion = await params.client.chatCompletion({
        messages: currentMessages,
        model: params.taskParams.model || LEANSTRAL_MODEL,
        tools: LEAN_PROOF_TOOLS,
        tool_choice: "auto",
        ...params.taskParams.modelSettings,
        max_tokens: maxTokens,
      });
      const toolCalls = completion.toolCalls.map((call, index): AgentToolCall => ({
        id: call.id ?? `lean_${step}_${index}`,
        name: call.function?.name ?? call.name ?? "",
        arguments: parseToolCallArguments(call.function?.arguments ?? call.arguments),
        raw: call,
      }));

      return {
        toolCalls,
        text: completion.content,
        assistantMessage: completion.message,
        usage: completion.usage,
      };
    },
    executeToolCalls: async (calls, context) => {
      for (const call of calls) {
        await params.checkpoint("Lean proof run cancelled before tool execution");
        params.state.commandCount += 1;

        try {
          if (call.name === LEAN_READ_FILE_TOOL) {
            const args = parseLeanReadArgs(call.arguments);
            const path = assertRequestedTarget(args.path, request.targetPaths);
            const targetFiles = await assertLeanTargetFileLimits({
              sandbox: params.sandbox,
              repositoryRoot: params.repositoryRoot,
              targetPaths: request.targetPaths,
            });
            const target = targetFiles.find((file) => file.path === path);

            if (!target) {
              throw new Error(`Lean target size was not checked: ${path}`);
            }

            const raw = await params.sandbox.readFile(target.resolvedPath);

            if (!raw.success) {
              throw new Error(`Failed to read Lean target: ${path}`);
            }

            const source = raw.content;
            const lines = source.split("\n");
            const content = lines
              .slice(args.startLine - 1, args.endLine)
              .map((line, index) => `${args.startLine + index}: ${line}`)
              .join("\n")
              .slice(0, 16_000);

            context.messages.push(toolResult(call, content || "Target file is empty."));
            await params.emit({
              type: "lean_file_read",
              path,
              startLine: args.startLine,
              endLine: Math.min(args.endLine, lines.length),
            });
            continue;
          }

          if (call.name === LEAN_SEARCH_TOOL) {
            const { query } = parseLeanSearchArgs(call.arguments);
            const matches: string[] = [];
            const targetFiles = await assertLeanTargetFileLimits({
              sandbox: params.sandbox,
              repositoryRoot: params.repositoryRoot,
              targetPaths: request.targetPaths,
            });

            for (const target of targetFiles) {
              const raw = await params.sandbox.readFile(target.resolvedPath);

              if (!raw.success) {
                throw new Error(`Failed to read Lean target: ${target.path}`);
              }

              const source = raw.content;

              source.split("\n").forEach((line, index) => {
                if (matches.length < 100 && line.includes(query)) {
                  matches.push(`${target.path}:${index + 1}: ${line}`);
                }
              });
            }

            context.messages.push(
              toolResult(call, matches.join("\n").slice(0, 16_000) || "No literal matches."),
            );
            continue;
          }

          if (call.name === LEAN_REPLACE_TOOL) {
            const args = parseLeanReplaceArgs(call.arguments);
            const path = assertRequestedTarget(args.path, request.targetPaths);
            const targetFiles = await assertLeanTargetFileLimits({
              sandbox: params.sandbox,
              repositoryRoot: params.repositoryRoot,
              targetPaths: request.targetPaths,
            });
            const target = targetFiles.find((file) => file.path === path);

            if (!target) {
              throw new Error(`Lean target size was not checked: ${path}`);
            }

            const raw = await params.sandbox.readFile(target.resolvedPath);

            if (!raw.success) {
              throw new Error(`Failed to read Lean target: ${path}`);
            }

            const source = raw.content;
            const occurrences = source.split(args.oldText).length - 1;

            if (occurrences !== 1) {
              throw new Error(
                `Exact replacement requires one match in ${path}; found ${occurrences}`,
              );
            }

            const replacementSource = source.replace(args.oldText, args.newText);

            assertLeanReplacementFileLimits(targetFiles, path, replacementSource);
            await params.sandbox.writeFile(target.resolvedPath, replacementSource);
            context.messages.push(toolResult(call, `Updated ${path} with one exact replacement.`));
            await params.emit({ type: "file_changed", path, changeType: "modified" });
            continue;
          }

          if (call.name === LEAN_CHECK_TOOL) {
            params.state.latestValidation = await validateLeanProof({
              sandbox: params.sandbox,
              repositoryRoot: params.repositoryRoot,
              targetPaths: request.targetPaths,
              declarations: request.declarations,
              abortSignal: params.abortSignal,
            });
            const validation = params.state.latestValidation;
            const summary = validation.evidence
              .map((entry) => `${entry.status}: ${entry.summary}`)
              .join("\n")
              .slice(0, 16_000);

            context.messages.push(toolResult(call, summary));
            await params.emit({
              type: "lean_proof_checked",
              message: `Lean validation outcome: ${validation.outcome}`,
            });
            continue;
          }

          if (call.name === LEAN_LSP_DIAGNOSTICS_TOOL) {
            const { path: requestedPath } = parseLeanLspArgs(call.arguments);
            const path = assertRequestedTarget(requestedPath, request.targetPaths);
            const targetFiles = await assertLeanTargetFileLimits({
              sandbox: params.sandbox,
              repositoryRoot: params.repositoryRoot,
              targetPaths: request.targetPaths,
            });
            const target = targetFiles.find((file) => file.path === path);

            if (!target) {
              throw new Error(`Lean target size was not checked: ${path}`);
            }

            const diagnostics = await params.sandbox.exec(
              `timeout 75s polychat-lean-lsp-advisory ${quoteForShell(params.repositoryRoot)} ${quoteForShell(target.resolvedPath)}`,
            );
            const output = [diagnostics.stdout, diagnostics.stderr]
              .filter(Boolean)
              .join("\n")
              .slice(0, 16_000);

            context.messages.push(
              toolResult(
                call,
                diagnostics.success
                  ? output || "Lean LSP MCP returned no diagnostics."
                  : `Advisory LSP diagnostics unavailable: ${output || `exit ${diagnostics.exitCode}`}`,
                diagnostics.success ? "success" : "error",
              ),
            );
            await params.emit({
              type: "lean_lsp_diagnostics",
              path,
              message: diagnostics.success
                ? "Lean LSP MCP advisory diagnostics completed"
                : "Lean LSP MCP advisory diagnostics were unavailable; compiler checks remain authoritative",
            });
            continue;
          }

          context.messages.push(toolResult(call, `Unknown Lean proof tool: ${call.name}`, "error"));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Lean proof tool failed";

          context.messages.push(toolResult(call, message, "error"));
          await params.emit({ type: "lean_tool_failed", action: call.name, error: message });
        }
      }
    },
    assessFinish: async () => {
      params.state.latestValidation = await validateLeanProof({
        sandbox: params.sandbox,
        repositoryRoot: params.repositoryRoot,
        targetPaths: request.targetPaths,
        declarations: request.declarations,
        abortSignal: params.abortSignal,
      });

      if (params.state.latestValidation.outcome === "incomplete") {
        return {
          allow: false,
          instruction:
            "The independent Lean compiler gate still fails. Read the diagnostics, make a different minimal replacement, and check again.",
        };
      }

      return { allow: true, outcome: "satisfied" };
    },
  });
}

function buildLeanResult(params: {
  request: NonNullable<TaskParams["leanProof"]>;
  validation?: LeanValidationResult;
  outcome?: LeanProofResult["outcome"];
  summary: string;
  changedPaths: string[];
  usage: AgentTokenUsage;
}): LeanProofResult {
  return {
    outcome: params.outcome ?? params.validation?.outcome ?? "failed",
    summary: normaliseLeanProofSummary(params.summary),
    targetPaths: params.request.targetPaths,
    declarations: params.request.declarations,
    changedPaths: params.changedPaths,
    diagnostics: params.validation?.diagnostics ?? [],
    evidence: params.validation?.evidence ?? [],
    usage: params.usage,
  };
}

export function canCommitLeanProof(validation: LeanValidationResult): boolean {
  return (
    validation.outcome !== "incomplete" &&
    validation.outcome !== "failed" &&
    validation.evidence.every((entry) => entry.status === "passed")
  );
}

export async function executeLeanProof(
  params: TaskParams,
  secrets: TaskSecrets,
  env: Env,
  emitEvent?: TaskEventEmitter,
  abortSignal?: AbortSignal,
): Promise<TaskResult> {
  if (!params.leanProof) {
    throw new Error("Lean proof runner requires a leanProof request");
  }

  if (!env.LeanSandbox) {
    throw new Error("LeanSandbox container binding is required");
  }

  const runId = params.runId || crypto.randomUUID().slice(0, 8);
  const sandbox = getSandbox(env.LeanSandbox, runId);
  const client = new PolychatClient(secrets.userToken, env.POLYCHAT_API);
  const logs: string[] = [];
  const state: LeanAgentState = { commandCount: 0, usage: emptyUsage() };
  let branchName: string | undefined;
  let changedPaths: string[] = [];
  const emit = async (event: TaskEvent) => {
    await emitEvent?.({ ...event, runId });
  };

  const executionControl = createExecutionControl({
    runId,
    timeoutSeconds: params.timeoutSeconds,
    userToken: secrets.userToken,
    apiService: env.POLYCHAT_API,
    abortSignal,
    emitEvent,
  });
  const checkpoint = (message: string) => executionControl.checkpoint(message);
  const request = params.leanProof;

  try {
    await checkpoint("Lean proof run cancelled before repository checkout");
    await emit({
      type: "task_started",
      task: params.task,
      repo: params.repo,
      model: params.model || LEANSTRAL_MODEL,
      language: "lean4",
      installationId: params.installationId,
    });

    const repo = resolveGitHubRepo(params.repo, secrets.githubToken);

    if (repo.checkoutAuthHeader) {
      await execOrThrowRedacted(
        sandbox,
        `git -c http.extraHeader=${quoteForShell(repo.checkoutAuthHeader)} clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)}`,
        logs,
        `git clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)} [auth header redacted]`,
      );
    } else {
      await sandbox.gitCheckout(repo.checkoutUrl, { targetDir: repo.targetDir, depth: 1 });
    }

    const root = await sandbox.exec("pwd");

    if (!root.success || !root.stdout.trim()) {
      throw new Error("Failed to resolve Lean sandbox working directory");
    }

    const repositoryRoot = `${root.stdout.trim().replace(/\/+$/, "")}/${repo.targetDir}`;

    await assertLeanRepositoryPreflight({
      sandbox,
      repositoryRoot,
      targetPaths: request.targetPaths,
      logs,
    });
    await emit({ type: "lean_preflight_completed", message: "Lean toolchain and targets ready" });

    if (params.shouldCommit) {
      branchName = buildLeanProofBranchName(runId);
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repositoryRoot)} checkout -b ${quoteForShell(branchName)}`,
        logs,
      );
      await emit({ type: "git_branch_created", branchName });
    }

    const loop = await executeLeanAgent({
      taskParams: params,
      sandbox,
      repositoryRoot,
      client,
      emit,
      checkpoint,
      state,
      abortSignal,
    });

    await checkpoint("Lean proof run cancelled before final validation");
    const validation =
      state.latestValidation ??
      (await validateLeanProof({
        sandbox,
        repositoryRoot,
        targetPaths: request.targetPaths,
        declarations: request.declarations,
        abortSignal,
      }));
    const targetArguments = request.targetPaths.map(quoteForShell).join(" ");
    const changed = await sandbox.exec(
      `git -C ${quoteForShell(repositoryRoot)} diff --name-only -- ${targetArguments}`,
    );

    if (!changed.success) {
      throw new Error(changed.stderr || "Failed to list Lean proof changes");
    }

    changedPaths = changed.stdout
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => request.targetPaths.includes(entry));
    const diffResult = await sandbox.exec(
      `git -C ${quoteForShell(repositoryRoot)} diff --patch -- ${targetArguments}`,
    );

    if (!diffResult.success) {
      throw new Error(diffResult.stderr || "Failed to generate Lean proof diff");
    }

    const deterministicChecksPassed = canCommitLeanProof(validation);

    if (params.shouldCommit && deterministicChecksPassed && changedPaths.length > 0) {
      await checkpoint("Lean proof run cancelled before commit");
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repositoryRoot)} config user.name ${quoteForShell("Polychat Bot")}`,
        logs,
      );
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repositoryRoot)} config user.email ${quoteForShell("bot@polychat.app")}`,
        logs,
      );
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repositoryRoot)} add -- ${targetArguments}`,
        logs,
      );
      await execOrThrow(
        sandbox,
        `git -C ${quoteForShell(repositoryRoot)} commit -m ${quoteForShell(buildCommitMessage(params.task))}`,
        logs,
      );

      if (branchName) {
        await pushBranchToRemote({
          sandbox,
          repoTargetDir: repositoryRoot,
          branchName,
          checkoutAuthHeader: repo.checkoutAuthHeader,
          executionLogs: logs,
          checkpoint,
          emit,
        });
      }
    } else if (params.shouldCommit && changedPaths.length > 0) {
      await emit({
        type: "commit_skipped",
        message: "Skipped commit because deterministic Lean checks did not all pass",
      });
    }

    const summary = normaliseLeanProofSummary(
      [
        loop.summary,
        `Lean validation outcome: ${validation.outcome}.`,
        changedPaths.length ? `Changed ${changedPaths.join(", ")}.` : "No target files changed.",
      ].join(" "),
    );
    const leanProof = buildLeanResult({
      request,
      validation,
      summary,
      changedPaths,
      usage: state.usage,
    });

    await emit({ type: "lean_proof_completed", leanProof, usage: state.usage });

    return {
      success: true,
      logs: truncateLog(logs.join("\n")),
      diff: diffResult.stdout,
      branchName,
      summary,
      usage: state.usage,
      leanProof,
    };
  } catch (error) {
    const classified = classifySandboxError(error);
    const tokenBudget = error instanceof AgentTokenBudgetExceededError ? error.tokenBudget : null;
    const budgetExceeded = tokenBudget !== null;
    const outcome = budgetExceeded || classified.type === "cancelled" ? "incomplete" : "failed";
    const summary = normaliseLeanProofSummary(
      budgetExceeded
        ? `Lean proof stopped at its ${tokenBudget}-token budget.`
        : classified.message,
    );
    const leanProof = buildLeanResult({
      request,
      validation: state.latestValidation,
      outcome,
      summary,
      changedPaths,
      usage: state.usage,
    });

    await emit({
      type: classified.type === "cancelled" ? "task_cancelled" : "task_failed",
      error: summary,
      errorType: classified.type,
      retryable: classified.retryable,
      leanProof,
      usage: state.usage,
    });

    return {
      success: false,
      logs: truncateLog(logs.join("\n")),
      branchName,
      error: summary,
      errorType: classified.type,
      usage: state.usage,
      leanProof,
    };
  } finally {
    await sandbox.destroy();
  }
}
