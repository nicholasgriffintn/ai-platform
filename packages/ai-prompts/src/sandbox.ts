import { PromptNotFoundError } from "./errors.js";
import { getPromptText, renderPrompt, tryGetPrompt } from "./prompts.js";

export type SandboxStrategyPhase = "planning" | "execution" | "examples";

export interface SandboxPromptStrategy {
  key: string;
  label: string;
  reason: string;
}

function getStrategyText(key: string, phase: SandboxStrategyPhase): string {
  const entry = tryGetPrompt(`sandbox/strategy/${key}/${phase}`);

  if (!entry) {
    throw new PromptNotFoundError(`sandbox/strategy/${key}/${phase}`);
  }

  return entry.text;
}

export interface RepositoryContextInput {
  topLevelEntries: readonly string[];
  fileSnippets: readonly { path: string; snippet: string }[];
  taskInstructions?: { source: string; path: string; snippet: string } | null;
}

export function buildRepositoryContext(context: RepositoryContextInput): string {
  const topLevelEntries =
    context.topLevelEntries.length > 0
      ? context.topLevelEntries.map((entry) => `- ${entry}`).join("\n")
      : getPromptText("sandbox/repository-context/top-level-unavailable");
  const fileContext =
    context.fileSnippets.length > 0
      ? context.fileSnippets
          .map((file) =>
            renderPrompt("sandbox/repository-context/file", {
              path: file.path,
              snippet: file.snippet,
            }),
          )
          .join("\n\n")
      : getPromptText("sandbox/repository-context/no-files");
  const taskInstructions = context.taskInstructions
    ? renderPrompt("sandbox/repository-context/instruction-found", {
        source: context.taskInstructions.source.toUpperCase(),
        path: context.taskInstructions.path,
        snippet: context.taskInstructions.snippet,
      })
    : getPromptText("sandbox/repository-context/no-instructions");

  return renderPrompt("sandbox/repository-context", {
    topLevelEntries,
    fileContext,
    taskInstructions,
  });
}

export function buildSandboxStrategySection(strategy: SandboxPromptStrategy): string {
  return renderPrompt("sandbox/strategy/planning-section", {
    strategyLabel: strategy.label,
    strategy: strategy.key,
    reason: strategy.reason,
    planningFocus: getStrategyText(strategy.key, "planning"),
    examples: getStrategyText(strategy.key, "examples"),
  });
}

export interface SandboxPlanningPromptOptions {
  repoName: string;
  task: string;
  repositoryContext: string;
  strategy: SandboxPromptStrategy;
}

export function buildSandboxPlanningPrompt({
  repoName,
  task,
  repositoryContext,
  strategy,
}: SandboxPlanningPromptOptions): string {
  return renderPrompt("sandbox/planning", {
    repoName,
    task,
    repositoryContext,
    strategySection: buildSandboxStrategySection(strategy),
  });
}

export interface SandboxAgentSystemPromptOptions {
  repoTargetDir: string;
  strategy: SandboxPromptStrategy;
  maxReadFilesBatch: number;
  readOnlyCommands?: boolean;
}

export function buildSandboxAgentSystemPrompt({
  repoTargetDir,
  strategy,
  maxReadFilesBatch,
  readOnlyCommands = false,
}: SandboxAgentSystemPromptOptions): string {
  return renderPrompt("sandbox/agent-system", {
    repoTargetDir,
    strategyLabel: strategy.label,
    strategy: strategy.key,
    reason: strategy.reason,
    executionFocus: getStrategyText(strategy.key, "execution"),
    maxReadFilesBatch,
    readOnlyCommandsRule: readOnlyCommands ? "true" : undefined,
  });
}

export interface SandboxKickoffPromptOptions {
  repoName: string;
  task: string;
  plan: string;
  repositoryContext: string;
  strategy: SandboxPromptStrategy;
  maxCommands: number;
  maxAgentSteps: number;
}

export function buildSandboxKickoffPrompt({
  repoName,
  task,
  plan,
  repositoryContext,
  strategy,
  maxCommands,
  maxAgentSteps,
}: SandboxKickoffPromptOptions): string {
  return renderPrompt("sandbox/kickoff", {
    repoName,
    task,
    plan,
    repositoryContext,
    strategyLabel: strategy.label,
    strategy: strategy.key,
    reason: strategy.reason,
    maxCommands,
    maxAgentSteps,
  });
}

export function buildSandboxReadErrorObservation({
  path,
  error,
}: {
  path: string;
  error: string;
}): string {
  return renderPrompt("sandbox/observation/read-error", { path, error });
}

export function buildSandboxReadObservation({
  path,
  startLine,
  endLine,
  content,
  truncated,
}: {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  truncated: boolean;
}): string {
  return renderPrompt("sandbox/observation/read", {
    path,
    startLine,
    endLine,
    content,
    truncatedNotice: truncated ? "Output was truncated." : undefined,
  });
}

export function buildSandboxCommandObservation({
  command,
  result,
}: {
  command: string;
  result: { exitCode: number; stdout: string; stderr: string; success: boolean };
}): string {
  return renderPrompt("sandbox/observation/command", {
    command,
    success: result.success,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}
