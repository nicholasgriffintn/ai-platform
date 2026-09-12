import type { SandboxTaskType } from "./sandbox-constants.js";
import {
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  type SandboxDeliveryPolicy,
} from "./sandbox-delivery.js";

export interface SandboxTaskProfileInput {
  task: string;
  taskType?: SandboxTaskType;
  deliveryPolicy?: SandboxDeliveryPolicy;
  shouldCommit?: boolean;
}

export interface ResolvedSandboxTaskProfile {
  taskType: SandboxTaskType;
  task: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  shouldCommit: boolean;
  readOnlyCommands: boolean;
}

function buildCodeReviewTask(task: string): string {
  return [
    "Run a code review over the repository scope requested below.",
    "Focus on correctness, security, regressions, and missing tests.",
    "Do not modify files or create commits for this task.",
    `Review request: ${task}`,
  ].join("\n");
}

function buildTestSuiteTask(task: string): string {
  return [
    "Run and analyse the relevant test suites for the repository.",
    "Prefer deterministic commands and report failing tests with root cause hypotheses.",
    "Do not modify files or create commits for this task.",
    `Test request: ${task}`,
  ].join("\n");
}

function buildBugFixTask(task: string): string {
  return [
    "Diagnose and fix the bug described below.",
    "Prefer minimal, maintainable changes and update tests where needed.",
    `Bug report: ${task}`,
  ].join("\n");
}

function buildRefactoringTask(task: string): string {
  return [
    "Refactor the repository area described below.",
    "Preserve existing behaviour while improving readability, structure, or maintainability.",
    "Update or add tests if behavioural risk is introduced.",
    `Refactoring scope: ${task}`,
  ].join("\n");
}

function buildDocumentationTask(task: string): string {
  return [
    "Create or update documentation for the requested scope.",
    "Keep documentation aligned with current behaviour and repository conventions.",
    "Prefer concise, practical documentation with examples where useful.",
    `Documentation request: ${task}`,
  ].join("\n");
}

function buildMigrationTask(task: string): string {
  return [
    "Perform the requested migration safely.",
    "Prefer incremental, reversible changes with clear validation steps.",
    "Update tests and related docs to reflect the migrated behaviour.",
    `Migration scope: ${task}`,
  ].join("\n");
}

function applyCustomDeliveryInstructions(
  task: string,
  deliveryPolicy: SandboxDeliveryPolicy,
): string {
  if (deliveryPolicy.mode !== "custom") {
    return task;
  }

  return [
    task,
    "",
    "Custom delivery instructions:",
    deliveryPolicy.instructions,
    "These instructions do not authorise a remote GitHub write.",
  ].join("\n");
}

export function resolveSandboxTaskProfile(
  input: SandboxTaskProfileInput,
): ResolvedSandboxTaskProfile {
  const taskType = input.taskType ?? "feature-implementation";
  const trimmedTask = input.task.trim();
  const deliveryPolicy = resolveSandboxDeliveryPolicy(input.deliveryPolicy, input.shouldCommit);

  if (!trimmedTask) {
    throw new Error("Task is required");
  }

  if (taskType === "code-review") {
    return {
      taskType,
      task: buildCodeReviewTask(trimmedTask),
      deliveryPolicy: { mode: "leave_uncommitted" },
      shouldCommit: false,
      readOnlyCommands: true,
    };
  }

  if (taskType === "test-suite") {
    return {
      taskType,
      task: buildTestSuiteTask(trimmedTask),
      deliveryPolicy: { mode: "leave_uncommitted" },
      shouldCommit: false,
      readOnlyCommands: true,
    };
  }

  const taskBuilders: Partial<Record<SandboxTaskType, (task: string) => string>> = {
    "bug-fix": buildBugFixTask,
    documentation: buildDocumentationTask,
    migration: buildMigrationTask,
    refactoring: buildRefactoringTask,
  };
  const task = taskBuilders[taskType]?.(trimmedTask) ?? trimmedTask;

  return {
    taskType,
    task: applyCustomDeliveryInstructions(task, deliveryPolicy),
    deliveryPolicy,
    shouldCommit: sandboxDeliveryPolicyCreatesCommit(deliveryPolicy),
    readOnlyCommands: false,
  };
}
