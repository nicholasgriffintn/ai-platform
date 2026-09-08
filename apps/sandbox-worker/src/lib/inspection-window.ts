import {
  sandboxCommandSchema,
  type SandboxRunControl,
  type SandboxRunEvent,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

import { throwIfAborted } from "./cancellation";
import {
  assertSafeCommand,
  quoteForShell,
  runSandboxCommand,
  type SandboxExecInstance,
} from "./commands";
import { delay } from "./delay";
import { redactSandboxOutput } from "./output-redaction";
import type { RunControlClient } from "./run-control-client";
import { withSandboxEnvironment } from "./sandbox-environment-runtime";

const POLL_INTERVAL_MS = 500;
const MAX_INSPECTION_COMMANDS = 12;
const MAX_OUTPUT_CHARS = 12_000;
const CONTROL_PROPAGATION_GRACE_MS = 5000;

function remainingInspectionSeconds(control: SandboxRunControl): number {
  if (!control.inspectionExpiresAt) {
    return 0;
  }

  const expiresAt = Date.parse(control.inspectionExpiresAt);

  return Number.isFinite(expiresAt) ? Math.max(0, (expiresAt - Date.now()) / 1000) : 0;
}

export async function waitForInspectionWindow(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  controlClient: RunControlClient;
  inspectionWindowSeconds: number;
  trustLevel: SandboxTrustLevel;
  environmentVariables?: Record<string, string>;
  environmentVariableNames: readonly string[];
  redactionSecrets: readonly string[];
  emit: (event: SandboxRunEvent) => Promise<void>;
  abortSignal?: AbortSignal;
}): Promise<void> {
  let cursor = 0;
  let commandCount = 0;
  const startedAt = Date.now();

  while (true) {
    throwIfAborted(params.abortSignal, "Sandbox inspection window cancelled");
    const control = await params.controlClient.fetchControlState(params.abortSignal);

    if (!control) {
      return;
    }

    if (control.state !== "inspection") {
      if (
        control.state === "running" &&
        Date.now() - startedAt < CONTROL_PROPAGATION_GRACE_MS &&
        params.inspectionWindowSeconds > 0
      ) {
        await delay(POLL_INTERVAL_MS, params.abortSignal);
        continue;
      }

      return;
    }

    const remainingSeconds = remainingInspectionSeconds(control);

    if (remainingSeconds <= 0) {
      await params.emit({
        type: "inspection_window_expired",
        message: "Sandbox inspection window closed.",
      });

      return;
    }

    const instructions = await params.controlClient.listInstructions(cursor, params.abortSignal);

    for (const envelope of instructions) {
      throwIfAborted(params.abortSignal, "Sandbox inspection window cancelled");
      const timeoutMs = Math.ceil(remainingInspectionSeconds(control) * 1000);

      if (timeoutMs <= 0) {
        await params.emit({
          type: "inspection_window_expired",
          message: "Sandbox inspection window closed.",
        });

        return;
      }

      cursor = Math.max(cursor, envelope.index);
      const instruction = envelope.instruction;

      if (instruction.kind !== "run_command" || !instruction.command) {
        continue;
      }

      if (commandCount >= MAX_INSPECTION_COMMANDS) {
        await params.emit({
          type: "command_failed",
          instructionId: instruction.id,
          action: "runner",
          command: instruction.command,
          error: "Inspection command limit reached",
        });
        continue;
      }

      commandCount += 1;
      const parsedCommand = sandboxCommandSchema.safeParse(instruction.command);

      if (!parsedCommand.success) {
        await params.emit({
          type: "command_failed",
          instructionId: instruction.id,
          action: "runner",
          command: instruction.command,
          error: parsedCommand.error.message,
        });
        continue;
      }

      try {
        assertSafeCommand(parsedCommand.data, {
          readOnly: false,
          trustLevel: params.trustLevel,
          allowNetwork: false,
          allowRisky: false,
        });
      } catch (error) {
        await params.emit({
          type: "command_failed",
          instructionId: instruction.id,
          action: "runner",
          command: parsedCommand.data,
          error: error instanceof Error ? error.message : "Command blocked by sandbox policy",
        });
        continue;
      }

      await params.emit({
        type: "command_started",
        instructionId: instruction.id,
        action: "runner",
        command: parsedCommand.data,
        commandIndex: commandCount,
        commandTotal: MAX_INSPECTION_COMMANDS,
      });

      const result = await runSandboxCommand(
        params.sandbox,
        `cd ${quoteForShell(params.repoTargetDir)} && ${withSandboxEnvironment(parsedCommand.data, params.environmentVariables, params.environmentVariableNames)}`,
        {
          abortSignal: params.abortSignal,
          timeoutMs,
          redactionSecrets: params.redactionSecrets,
          onOutput: async (output) => {
            await params.emit({
              type: "command_output",
              instructionId: instruction.id,
              action: "runner",
              command: parsedCommand.data,
              commandIndex: commandCount,
              commandTotal: MAX_INSPECTION_COMMANDS,
              stream: output.stream,
              output: redactSandboxOutput(output.data, params.redactionSecrets).slice(
                -MAX_OUTPUT_CHARS,
              ),
            });
          },
        },
      );
      const stdout = redactSandboxOutput(result.stdout, params.redactionSecrets).slice(
        -MAX_OUTPUT_CHARS,
      );
      const stderr = redactSandboxOutput(result.stderr, params.redactionSecrets).slice(
        -MAX_OUTPUT_CHARS,
      );

      await params.emit({
        type: result.success ? "command_completed" : "command_failed",
        instructionId: instruction.id,
        action: "runner",
        command: parsedCommand.data,
        commandIndex: commandCount,
        commandTotal: MAX_INSPECTION_COMMANDS,
        exitCode: result.exitCode,
        output: stdout || stderr,
        error: result.success ? undefined : stderr || stdout || "Command failed",
      });
    }

    await delay(
      Math.min(POLL_INTERVAL_MS, Math.max(100, remainingSeconds * 1000)),
      params.abortSignal,
    );
  }
}
