import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { redactSandboxOutput } from "@ngriffin_uk/polychat-library-sandbox";
import type { SandboxTrustLevel } from "@ngriffin_uk/polychat-schemas";
import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

import {
  MAX_COMMANDS,
  MAX_CONSECUTIVE_COMMAND_FAILURES,
  MAX_PARALLEL_COMMANDS,
  MAX_READ_FILES_BATCH,
} from "../../../../config/agent";
import {
  assertSafeCommand,
  formatCommandResult,
  getCommandRiskLevel,
  runSandboxCommand,
} from "../commands";
import { withSandboxEnvironment } from "../sandbox-environment-runtime";
import { resolveCommandApproval } from "./command-approval";
import { readRepositoryFileSnippet } from "./context";
import { formatCommandObservation, formatReadObservation } from "./prompts";
import type {
  ReadFileDecision,
  ReadFilesDecision,
  RunCommandDecision,
  RunParallelDecision,
  RunScriptDecision,
} from "./tools";
import type { ExecuteAgentLoopParams } from "./types";

export interface AgentLoopMutableState {
  commandCount: number;
  consecutiveCommandFailures: number;
  lastActionSignature?: string;
  repeatedActionCount?: number;
}

export interface AgentLoopActionContext {
  sandbox: ExecuteAgentLoopParams["sandbox"];
  repoTargetDir: string;
  readOnlyCommands: boolean;
  trustLevel: SandboxTrustLevel;
  step: number;
  state: AgentLoopMutableState;
  observations: string[];
  executionLogs: string[];
  emit: ExecuteAgentLoopParams["emit"];
  approvalClient?: ExecuteAgentLoopParams["approvalClient"];
  abortSignal?: AbortSignal;
  guardExecution: (abortMessage: string) => Promise<void>;
  beginPlanRecovery: (reason: string) => void;
  redactionSecrets: readonly string[];
  environmentVariables?: Record<string, string>;
  environmentVariableNames: readonly string[];
}

async function guardAgainstRepeatedAction(
  context: AgentLoopActionContext,
  params: {
    signature: string;
    threshold: number;
    action: string;
    description: string;
  },
): Promise<boolean> {
  const signature = params.signature.trim();

  if (!signature) {
    return false;
  }

  if (context.state.lastActionSignature === signature) {
    context.state.repeatedActionCount = (context.state.repeatedActionCount ?? 1) + 1;
  } else {
    context.state.lastActionSignature = signature;
    context.state.repeatedActionCount = 1;
  }

  const repeatCount = context.state.repeatedActionCount ?? 1;

  if (repeatCount < params.threshold) {
    return false;
  }

  const reason =
    `Detected repeated action "${params.action}" ${repeatCount} times in a row.` +
    ` Last repeated target: ${params.description}`;

  await context.emit({
    type: "agent_repetition_detected",
    agentStep: context.step,
    action: params.action,
    repeatCount,
    message: reason,
    error: params.description,
  });
  context.beginPlanRecovery(reason);
  context.observations.push([reason, getPromptText("sandbox/notice/repeated-action")].join("\n"));

  return true;
}

export async function handleReadFileAction(
  context: AgentLoopActionContext,
  decision: ReadFileDecision,
): Promise<void> {
  const repeated = await guardAgainstRepeatedAction(context, {
    signature: `read_file:${decision.path}:${decision.startLine ?? ""}:${decision.endLine ?? ""}`,
    threshold: 3,
    action: "read_file",
    description: `${decision.path} (${decision.startLine ?? "start"}-${decision.endLine ?? "end"})`,
  });

  if (repeated) {
    return;
  }

  const readResult = await readRepositoryFileSnippet({
    sandbox: context.sandbox,
    repoTargetDir: context.repoTargetDir,
    path: decision.path,
    startLine: decision.startLine,
    endLine: decision.endLine,
  });

  await context.emit({
    type: "file_read",
    agentStep: context.step,
    path: readResult.path,
    startLine: readResult.startLine,
    endLine: readResult.endLine,
    truncated: readResult.truncated,
    error: readResult.error,
  });
  context.observations.push(formatReadObservation(readResult));
}

export async function handleReadFilesAction(
  context: AgentLoopActionContext,
  decision: ReadFilesDecision,
): Promise<void> {
  const repeated = await guardAgainstRepeatedAction(context, {
    signature: `read_files:${decision.files
      .map((file) => `${file.path}:${file.startLine ?? ""}:${file.endLine ?? ""}`)
      .join("|")}`,
    threshold: 3,
    action: "read_files",
    description: decision.files.map((file) => file.path).join(", "),
  });

  if (repeated) {
    return;
  }

  const requestedFiles = decision.files.filter(
    (file) => typeof file.path === "string" && file.path.trim().length > 0,
  );

  if (!requestedFiles.length) {
    context.observations.push("read_files requires at least one valid file target.");

    return;
  }

  const files = requestedFiles.slice(0, MAX_READ_FILES_BATCH);
  const results = await Promise.all(
    files.map((target) =>
      readRepositoryFileSnippet({
        sandbox: context.sandbox,
        repoTargetDir: context.repoTargetDir,
        path: target.path,
        startLine: target.startLine,
        endLine: target.endLine,
      }),
    ),
  );

  for (const result of results) {
    await context.emit({
      type: "file_read",
      agentStep: context.step,
      path: result.path,
      startLine: result.startLine,
      endLine: result.endLine,
      truncated: result.truncated,
      error: result.error,
    });
  }

  const truncatedLine =
    requestedFiles.length > files.length
      ? renderPrompt("sandbox/notice/read-batch-truncated", {
          maxReadFilesBatch: MAX_READ_FILES_BATCH,
        })
      : "";
  const observations = results
    .map(
      (result, index) => `[File ${index + 1}/${results.length}]\n${formatReadObservation(result)}`,
    )
    .join("\n\n");

  context.observations.push(
    [
      renderPrompt("sandbox/notice/read-batch-completed", {
        fileCount: results.length,
      }),
      truncatedLine,
      observations,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

export async function handleRunCommandAction(
  context: AgentLoopActionContext,
  decision: RunCommandDecision,
): Promise<void> {
  await context.guardExecution("Sandbox run cancelled before command execution");

  const repeated = await guardAgainstRepeatedAction(context, {
    signature: `run_command:${decision.command}`,
    threshold: 3,
    action: "run_command",
    description: decision.command,
  });

  if (repeated) {
    return;
  }

  if (context.state.commandCount >= MAX_COMMANDS) {
    throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
  }

  const riskLevel = getCommandRiskLevel(decision.command);
  const approval = await resolveCommandApproval({
    command: decision.command,
    riskLevel,
    trustLevel: context.trustLevel,
    agentStep: context.step,
    emit: context.emit,
    approvalClient: context.approvalClient,
    abortSignal: context.abortSignal,
    guardExecution: context.guardExecution,
  });

  if (approval.rejected) {
    context.observations.push(
      renderPrompt("sandbox/notice/approval-rejected", {
        command: decision.command,
        reason: approval.rejectedMessage ?? "No decision details provided.",
      }),
    );

    return;
  }

  try {
    assertSafeCommand(decision.command, {
      readOnly: context.readOnlyCommands,
      trustLevel: context.trustLevel,
      allowNetwork: approval.allowNetwork,
      allowRisky: approval.allowRisky,
    });
  } catch (error) {
    context.state.consecutiveCommandFailures += 1;
    const errorMessage =
      error instanceof Error ? error.message : "Command blocked by sandbox policy";

    await context.emit({
      type: "command_failed",
      command: decision.command,
      commandTotal: MAX_COMMANDS,
      agentStep: context.step,
      error: errorMessage,
    });
    context.observations.push(
      renderPrompt("sandbox/notice/command-blocked", {
        command: decision.command,
        error: errorMessage,
      }),
    );
    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Command policy/validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${errorMessage}`,
      );
      context.observations.push(getPromptText("sandbox/notice/command-failures-exhausted"));
    }

    return;
  }

  context.state.commandCount += 1;
  await context.emit({
    type: "command_started",
    command: decision.command,
    commandIndex: context.state.commandCount,
    commandTotal: MAX_COMMANDS,
    agentStep: context.step,
  });

  const result = await runSandboxCommand(
    context.sandbox,
    `cd ${quoteShellArgument(context.repoTargetDir)} && ${withSandboxEnvironment(decision.command, context.environmentVariables, context.environmentVariableNames)}`,
    {
      abortSignal: context.abortSignal,
      redactionSecrets: context.redactionSecrets,
      onOutput: async (output) => {
        await context.emit({
          type: "command_output",
          command: decision.command,
          commandIndex: context.state.commandCount,
          commandTotal: MAX_COMMANDS,
          agentStep: context.step,
          stream: output.stream,
          output: redactSandboxOutput(output.data, context.redactionSecrets),
        });
      },
    },
  );

  const safeResult = {
    ...result,
    stdout: redactSandboxOutput(result.stdout, context.redactionSecrets),
    stderr: redactSandboxOutput(result.stderr, context.redactionSecrets),
  };

  context.executionLogs.push(formatCommandResult(decision.command, safeResult));

  if (!result.success) {
    context.state.consecutiveCommandFailures += 1;
    const failureMessage = safeResult.stderr || safeResult.stdout || "Unknown command failure";

    await context.emit({
      type: "command_failed",
      command: decision.command,
      commandIndex: context.state.commandCount,
      commandTotal: MAX_COMMANDS,
      agentStep: context.step,
      exitCode: safeResult.exitCode,
      error: failureMessage,
    });

    context.observations.push(
      formatCommandObservation({
        command: decision.command,
        result: safeResult,
      }),
    );

    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Command execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last failure: ${failureMessage}`,
      );
      context.observations.push(getPromptText("sandbox/notice/commands-failing"));
    }

    await context.guardExecution("Sandbox run cancelled after command execution");

    return;
  }

  context.state.consecutiveCommandFailures = 0;
  await context.emit({
    type: "command_completed",
    command: decision.command,
    commandIndex: context.state.commandCount,
    commandTotal: MAX_COMMANDS,
    agentStep: context.step,
    exitCode: result.exitCode,
  });
  context.observations.push(
    formatCommandObservation({
      command: decision.command,
      result,
    }),
  );
  await context.guardExecution("Sandbox run cancelled after command execution");
}

export async function handleRunParallelAction(
  context: AgentLoopActionContext,
  decision: RunParallelDecision,
): Promise<void> {
  await context.guardExecution("Sandbox run cancelled before parallel command execution");

  const repeated = await guardAgainstRepeatedAction(context, {
    signature: `run_parallel:${decision.commands.join("|")}`,
    threshold: 2,
    action: "run_parallel",
    description: decision.commands.join(" | "),
  });

  if (repeated) {
    return;
  }

  const requestedCommands = decision.commands.map((entry) => entry.trim()).filter(Boolean);

  if (!requestedCommands.length) {
    context.observations.push(
      "run_parallel requires at least one non-empty command. Use update_plan or provide valid commands.",
    );

    return;
  }

  const commands = requestedCommands.slice(0, MAX_PARALLEL_COMMANDS);

  if (context.state.commandCount + commands.length > MAX_COMMANDS) {
    throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
  }

  let blockedCommand: { command: string; error: string } | null = null;

  for (const command of commands) {
    try {
      assertSafeCommand(command, {
        readOnly: true,
        trustLevel: context.trustLevel,
        allowNetwork: false,
        allowRisky: false,
      });
    } catch (error) {
      blockedCommand = {
        command,
        error: error instanceof Error ? error.message : "Command blocked by sandbox policy",
      };
      break;
    }
  }

  if (blockedCommand) {
    context.state.consecutiveCommandFailures += 1;
    await context.emit({
      type: "command_failed",
      command: blockedCommand.command,
      commandTotal: MAX_COMMANDS,
      agentStep: context.step,
      error: blockedCommand.error,
    });
    context.observations.push(
      [
        `Parallel command blocked: ${blockedCommand.command}`,
        `Error: ${blockedCommand.error}`,
        "run_parallel supports safe read-only commands only. Revise with update_plan before retrying.",
      ].join("\n"),
    );
    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Parallel command validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${blockedCommand.error}`,
      );
    }

    return;
  }

  const firstCommandIndex = context.state.commandCount + 1;

  context.state.commandCount += commands.length;

  for (let index = 0; index < commands.length; index += 1) {
    await context.emit({
      type: "command_started",
      command: commands[index],
      commandIndex: firstCommandIndex + index,
      commandTotal: MAX_COMMANDS,
      agentStep: context.step,
    });
  }

  const results = await Promise.all(
    commands.map((command, index) =>
      runSandboxCommand(
        context.sandbox,
        `cd ${quoteShellArgument(context.repoTargetDir)} && ${withSandboxEnvironment(command, context.environmentVariables, context.environmentVariableNames)}`,
        {
          abortSignal: context.abortSignal,
          redactionSecrets: context.redactionSecrets,
          onOutput: async (output) => {
            await context.emit({
              type: "command_output",
              command,
              commandIndex: firstCommandIndex + index,
              commandTotal: MAX_COMMANDS,
              agentStep: context.step,
              stream: output.stream,
              output: redactSandboxOutput(output.data, context.redactionSecrets),
            });
          },
        },
      ),
    ),
  );

  let failedCount = 0;
  const observationParts: string[] = [];

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    const result = results[index];
    const commandIndex = firstCommandIndex + index;

    const safeResult = {
      ...result,
      stdout: redactSandboxOutput(result.stdout, context.redactionSecrets),
      stderr: redactSandboxOutput(result.stderr, context.redactionSecrets),
    };

    context.executionLogs.push(formatCommandResult(command, safeResult));
    observationParts.push(
      formatCommandObservation({
        command,
        result: safeResult,
      }),
    );
    if (!result.success) {
      failedCount += 1;
      const failureMessage = safeResult.stderr || safeResult.stdout || "Unknown command failure";

      await context.emit({
        type: "command_failed",
        command,
        commandIndex,
        commandTotal: MAX_COMMANDS,
        agentStep: context.step,
        exitCode: result.exitCode,
        error: failureMessage,
      });
      continue;
    }

    await context.emit({
      type: "command_completed",
      command,
      commandIndex,
      commandTotal: MAX_COMMANDS,
      agentStep: context.step,
      exitCode: result.exitCode,
    });
  }

  if (failedCount > 0) {
    context.state.consecutiveCommandFailures += failedCount;
    const failureLine =
      failedCount === 1
        ? "1 command failed in the parallel batch."
        : `${failedCount} commands failed in the parallel batch.`;

    context.observations.push(
      [
        failureLine,
        getPromptText("sandbox/notice/review-parallel-outputs"),
        ...observationParts,
      ].join("\n\n"),
    );
    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Parallel commands produced repeated failures. Failed commands in last batch: ${failedCount}.`,
      );
    }

    await context.guardExecution("Sandbox run cancelled after parallel command execution");

    return;
  }

  context.state.consecutiveCommandFailures = 0;
  const truncationLine =
    requestedCommands.length > commands.length
      ? `Only the first ${MAX_PARALLEL_COMMANDS} commands were executed.`
      : "";

  context.observations.push(
    [
      `Parallel command batch succeeded (${commands.length} commands).`,
      truncationLine,
      ...observationParts,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  await context.guardExecution("Sandbox run cancelled after parallel command execution");
}

export async function handleRunScriptAction(
  context: AgentLoopActionContext,
  decision: RunScriptDecision,
): Promise<void> {
  await context.guardExecution("Sandbox run cancelled before script execution");

  const repeated = await guardAgainstRepeatedAction(context, {
    signature: `run_script:${decision.language ?? "javascript"}:${decision.code}`,
    threshold: 2,
    action: "run_script",
    description: decision.code,
  });

  if (repeated) {
    return;
  }

  if (context.readOnlyCommands || context.trustLevel === "strict") {
    context.observations.push(getPromptText("sandbox/notice/script-not-allowed"));

    return;
  }

  if (context.state.commandCount >= MAX_COMMANDS) {
    throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
  }

  context.state.commandCount += 1;
  const scriptLanguage = decision.language ?? "javascript";

  await context.emit({
    type: "script_started",
    code: decision.code,
    language: scriptLanguage,
    agentStep: context.step,
    commandIndex: context.state.commandCount,
    commandTotal: MAX_COMMANDS,
  });

  let execution: Awaited<ReturnType<typeof context.sandbox.runScript>>;

  try {
    execution = await context.sandbox.runScript({
      language: scriptLanguage,
      code: decision.code,
      cwd: context.repoTargetDir,
    });
  } catch (error) {
    context.state.consecutiveCommandFailures += 1;
    const errorMessage = error instanceof Error ? error.message : "Script execution failed";

    await context.emit({
      type: "script_failed",
      agentStep: context.step,
      commandIndex: context.state.commandCount,
      commandTotal: MAX_COMMANDS,
      error: errorMessage,
    });
    context.observations.push(
      renderPrompt("sandbox/notice/script-failed", {
        error: errorMessage,
      }),
    );
    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Script execution threw ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${errorMessage}`,
      );
      context.observations.push(getPromptText("sandbox/notice/script-attempts-failing"));
    }

    await context.guardExecution("Sandbox run cancelled after script execution");

    return;
  }

  const scriptOutput = [execution.stdout.trim(), execution.stderr.trim()]
    .filter(Boolean)
    .join("\n");

  context.executionLogs.push(`[script:${scriptLanguage}]\n${decision.code}\n---\n${scriptOutput}`);

  if (!execution.success) {
    context.state.consecutiveCommandFailures += 1;
    const errorMessage =
      execution.stderr.trim().split("\n").at(-1) || `Script exited with code ${execution.exitCode}`;

    await context.emit({
      type: "script_failed",
      agentStep: context.step,
      commandIndex: context.state.commandCount,
      commandTotal: MAX_COMMANDS,
      error: errorMessage,
    });

    const traceback = execution.stderr.trim() || undefined;

    context.observations.push(
      renderPrompt("sandbox/notice/script-error", {
        error: errorMessage,
        traceback,
      }),
    );

    if (context.state.consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
      context.beginPlanRecovery(
        `Script execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${errorMessage}`,
      );
      context.observations.push(getPromptText("sandbox/notice/script-failures-exhausted"));
    }

    await context.guardExecution("Sandbox run cancelled after script execution");

    return;
  }

  context.state.consecutiveCommandFailures = 0;
  await context.emit({
    type: "script_completed",
    agentStep: context.step,
    commandIndex: context.state.commandCount,
    commandTotal: MAX_COMMANDS,
  });

  context.observations.push(
    renderPrompt("sandbox/observation/script", {
      output: scriptOutput,
    }),
  );
  await context.guardExecution("Sandbox run cancelled after script execution");
}
