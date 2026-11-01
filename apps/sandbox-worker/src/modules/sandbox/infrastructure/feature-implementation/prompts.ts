import {
  buildRepositoryContext,
  buildSandboxAgentSystemPrompt,
  buildSandboxCommandObservation,
  buildSandboxKickoffPrompt,
  buildSandboxPlanningPrompt,
  buildSandboxReadErrorObservation,
  buildSandboxReadObservation,
  type SandboxPromptStrategy,
} from "@ngriffin_uk/polychat-ai-prompts";

import { MAX_AGENT_STEPS, MAX_COMMANDS, MAX_READ_FILES_BATCH } from "../../../../config/agent";
import type { PromptStrategySelection } from "./prompt-strategy";
import type { ReadFileResult, RepositoryContext } from "./types";

function toPromptStrategy(strategy: PromptStrategySelection): SandboxPromptStrategy {
  return {
    key: strategy.strategy,
    label: strategy.definition.label,
    reason: strategy.reason,
  };
}

function formatRepositoryContext(repoContext: RepositoryContext): string {
  return buildRepositoryContext({
    topLevelEntries: repoContext.topLevelEntries,
    fileSnippets: repoContext.files,
    taskInstructions: repoContext.taskInstructions
      ? {
          source: repoContext.taskInstructionSource,
          path: repoContext.taskInstructions.path,
          snippet: repoContext.taskInstructions.snippet,
        }
      : null,
  });
}

export function buildPlanningPrompt(params: {
  repoName: string;
  task: string;
  repoContext: RepositoryContext;
  promptStrategy: PromptStrategySelection;
}): string {
  return buildSandboxPlanningPrompt({
    repoName: params.repoName,
    task: params.task,
    repositoryContext: formatRepositoryContext(params.repoContext),
    strategy: toPromptStrategy(params.promptStrategy),
  });
}

export function buildAgentSystemPrompt(params: {
  repoTargetDir: string;
  promptStrategy: PromptStrategySelection;
  readOnlyCommands?: boolean;
}): string {
  return buildSandboxAgentSystemPrompt({
    repoTargetDir: params.repoTargetDir,
    strategy: toPromptStrategy(params.promptStrategy),
    maxReadFilesBatch: MAX_READ_FILES_BATCH,
    readOnlyCommands: params.readOnlyCommands,
  });
}

export function buildAgentKickoffPrompt(params: {
  repoName: string;
  task: string;
  plan: string;
  repoContext: RepositoryContext;
  promptStrategy: PromptStrategySelection;
}): string {
  return buildSandboxKickoffPrompt({
    repoName: params.repoName,
    task: params.task,
    plan: params.plan,
    repositoryContext: formatRepositoryContext(params.repoContext),
    strategy: toPromptStrategy(params.promptStrategy),
    maxCommands: MAX_COMMANDS,
    maxAgentSteps: MAX_AGENT_STEPS,
  });
}

export function formatReadObservation(result: ReadFileResult): string {
  if (result.error) {
    return buildSandboxReadErrorObservation({
      path: result.path,
      error: result.error,
    });
  }

  return buildSandboxReadObservation({
    path: result.path,
    startLine: result.startLine,
    endLine: result.endLine,
    content: result.content,
    truncated: result.truncated,
  });
}

export function formatCommandObservation(params: {
  command: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
    success: boolean;
  };
}): string {
  return buildSandboxCommandObservation({
    command: params.command,
    result: {
      exitCode: params.result.exitCode,
      success: params.result.success,
      stdout: params.result.stdout.trim(),
      stderr: params.result.stderr.trim(),
    },
  });
}
