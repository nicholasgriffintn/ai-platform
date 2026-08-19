import {
  executeAgentLoop as executeSharedAgentLoop,
  parseToolCallArguments,
  type AgentActionContext,
  type AgentLoopState,
  type AgentMessage,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";

import { throwIfAborted } from "../cancellation";
import { buildSummary } from "../commands";
import { PolychatApiError } from "../polychat-client";
import {
  handleReadFileAction,
  handleReadFilesAction,
  handleRunCommandAction,
  handleRunParallelAction,
  handleRunScriptAction,
} from "./agent-loop-actions";
import {
  MAX_CONSECUTIVE_DECISION_FAILURES,
  MAX_AGENT_STEPS,
  MAX_COMMANDS,
  MAX_OBSERVATION_CHARS,
  MAX_RECOVERY_REPLANS,
  MODEL_RETRY_OPTIONS,
} from "./constants";
import { buildAgentKickoffPrompt, buildAgentSystemPrompt } from "./prompts";
import {
  getSandboxAgentTools,
  parseReadFilesAction,
  parseRunCommandAction,
  parseRunScriptAction,
  READ_FILES_TOOL_NAME,
  RUN_COMMAND_TOOL_NAME,
  RUN_SCRIPT_TOOL_NAME,
} from "./tools";
import type { ExecuteAgentLoopParams } from "./types";

interface SandboxAgentLoopState extends AgentLoopState {
  commandCount: number;
  consecutiveCommandFailures: number;
  lastActionSignature?: string;
  repeatedActionCount: number;
  instructionCursor: number;
  pendingStepExtensions: number;
  autoStepExtensionsUsed: number;
}

interface SandboxAgentSharedContext {
  sandbox: ExecuteAgentLoopParams["sandbox"];
  repoTargetDir: string;
  readOnlyCommands: boolean;
  trustLevel: NonNullable<ExecuteAgentLoopParams["trustLevel"]>;
  executionLogs: string[];
  emit: ExecuteAgentLoopParams["emit"];
  approvalClient?: ExecuteAgentLoopParams["approvalClient"];
  abortSignal?: AbortSignal;
}

function toSandboxActionContext(
  context: AgentActionContext<SandboxAgentSharedContext, SandboxAgentLoopState>,
) {
  return {
    sandbox: context.shared.sandbox,
    repoTargetDir: context.shared.repoTargetDir,
    readOnlyCommands: context.shared.readOnlyCommands,
    trustLevel: context.shared.trustLevel,
    step: context.step,
    state: context.state,
    messages: context.messages,
    executionLogs: context.shared.executionLogs,
    emit: context.shared.emit,
    approvalClient: context.shared.approvalClient,
    abortSignal: context.shared.abortSignal,
    guardExecution: context.guardExecution,
    beginPlanRecovery: context.beginPlanRecovery,
  };
}

export async function executeAgentLoop(
  params: ExecuteAgentLoopParams,
): Promise<{ commandCount: number; summary: string; finalPlan: string }> {
  const {
    sandbox,
    client,
    model,
    modelSettings,
    repoDisplayName,
    repoTargetDir,
    task,
    taskType,
    promptStrategy,
    initialPlan,
    repoContext,
    executionLogs,
    emit,
    approvalClient,
    abortSignal,
    checkpoint,
  } = params;

  const guardExecution = async (abortMessage: string) => {
    if (checkpoint) {
      await checkpoint(abortMessage);

      return;
    }

    throwIfAborted(abortSignal, abortMessage);
  };

  const readOnlyCommands = taskType === "code-review" || taskType === "test-suite";
  const trustLevel = params.trustLevel ?? "balanced";
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt({
        repoTargetDir,
        promptStrategy,
        readOnlyCommands,
      }),
    },
    {
      role: "user",
      content: buildAgentKickoffPrompt({
        repoName: repoDisplayName,
        task,
        plan: initialPlan,
        repoContext,
        promptStrategy,
      }),
    },
  ];

  const state: SandboxAgentLoopState = {
    commandCount: 0,
    consecutiveCommandFailures: 0,
    repeatedActionCount: 0,
    instructionCursor: 0,
    pendingStepExtensions: 0,
    autoStepExtensionsUsed: 0,
  };

  const shared: SandboxAgentSharedContext = {
    sandbox,
    repoTargetDir,
    readOnlyCommands,
    trustLevel,
    executionLogs,
    emit,
    approvalClient,
    abortSignal,
  };

  const ingestOperatorInstructions = async (
    currentMessages: AgentMessage[],
    agentStep: number,
  ): Promise<void> => {
    if (!approvalClient) {
      return;
    }

    const instructions = await approvalClient.listInstructions(
      state.instructionCursor,
      abortSignal,
    );

    if (!instructions.length) {
      return;
    }

    for (const envelope of instructions) {
      if (envelope.index <= state.instructionCursor) {
        continue;
      }

      state.instructionCursor = envelope.index;
      const instruction = envelope.instruction;

      if (instruction.kind !== "message" && instruction.kind !== "continue") {
        continue;
      }

      const content = instruction.content?.trim();

      if (instruction.kind === "continue") {
        state.pendingStepExtensions += 1;
      }

      if (content) {
        currentMessages.push({
          role: "user",
          content:
            instruction.kind === "continue"
              ? `Operator requested continuation with guidance: ${content}`
              : `Operator message: ${content}`,
        });
      } else if (instruction.kind === "continue") {
        currentMessages.push({
          role: "user",
          content:
            "Operator requested continuation. Keep moving and prioritise finishing with clear validation.",
        });
      }

      await emit({
        type: "run_instruction_received",
        agentStep,
        instructionId: instruction.id,
        instructionKind: instruction.kind,
        instructionContent: content ? content.slice(0, 500) : undefined,
        message:
          instruction.kind === "continue"
            ? "Continue instruction received by worker"
            : "Operator message received by worker",
      });
    }
  };

  const agentTools = getSandboxAgentTools({ readOnlyCommands });

  const result = await executeSharedAgentLoop({
    initialMessages: messages,
    initialPlan,
    shared,
    state,
    guardExecution,
    emit,
    config: {
      maxSteps: MAX_AGENT_STEPS,
      maxConsecutiveTurnFailures: MAX_CONSECUTIVE_DECISION_FAILURES,
      maxRecoveryReplans: MAX_RECOVERY_REPLANS,
      maxObservationChars: MAX_OBSERVATION_CHARS,
    },
    shouldAbortOnTurnError: (error) => error instanceof PolychatApiError,
    getCommandCount: (runtimeState) => runtimeState.commandCount,
    resolveTurn: async ({ messages: currentMessages, step }) => {
      await ingestOperatorInstructions(currentMessages, step);

      const completion = await client.chatCompletion(
        {
          messages: currentMessages.map((message) => ({
            role: message.role,
            content:
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
          })),
          model,
          tools: agentTools,
          ...modelSettings,
        },
        MODEL_RETRY_OPTIONS,
      );

      const toolCalls: AgentToolCall[] = completion.toolCalls.map((toolCall, index) => ({
        id: toolCall.id ?? `call_${step}_${index}`,
        name: toolCall.function?.name ?? toolCall.name ?? "",
        arguments: parseToolCallArguments(toolCall.function?.arguments ?? toolCall.arguments),
        raw: toolCall,
      }));

      if (toolCalls.length === 0 && !completion.content.trim()) {
        throw new Error("Model returned neither a tool call nor a response");
      }

      return {
        toolCalls,
        text: completion.content,
        assistantMessage: {
          role: "assistant",
          content: completion.content || JSON.stringify(completion.toolCalls),
        },
      };
    },
    executeToolCalls: async (toolCalls, context) => {
      const actionContext = toSandboxActionContext(context);

      for (const toolCall of toolCalls) {
        if (toolCall.name === READ_FILES_TOOL_NAME) {
          const action = parseReadFilesAction(toolCall.arguments);

          if (action.files.length === 1) {
            await handleReadFileAction(actionContext, action.files[0]);
            continue;
          }

          await handleReadFilesAction(actionContext, action);
          continue;
        }

        if (toolCall.name === RUN_COMMAND_TOOL_NAME) {
          const action = parseRunCommandAction(toolCall.arguments);

          if (action.commands.length === 1) {
            await handleRunCommandAction(actionContext, { command: action.commands[0] });
            continue;
          }

          await handleRunParallelAction(actionContext, { commands: action.commands });
          continue;
        }

        if (toolCall.name === RUN_SCRIPT_TOOL_NAME) {
          await handleRunScriptAction(actionContext, parseRunScriptAction(toolCall.arguments));
          continue;
        }

        context.messages.push({
          role: "user",
          content: `Unknown tool "${toolCall.name}". Use one of the provided tools.`,
        });
      }
    },
    onPlanRecovery: ({ state: runtimeState }) => {
      runtimeState.consecutiveCommandFailures = 0;
      runtimeState.lastActionSignature = undefined;
      runtimeState.repeatedActionCount = 0;
    },
    onStepBudgetExceeded: async ({ step, state: runtimeState, messages: currentMessages }) => {
      await ingestOperatorInstructions(currentMessages, step);

      if (runtimeState.pendingStepExtensions > 0 && runtimeState.commandCount < MAX_COMMANDS) {
        runtimeState.pendingStepExtensions -= 1;

        return {
          extendBy: 24,
          reason: "Continuing execution after operator instruction",
        };
      }

      if (
        runtimeState.autoStepExtensionsUsed < 1 &&
        runtimeState.commandCount > 0 &&
        runtimeState.commandCount < MAX_COMMANDS
      ) {
        runtimeState.autoStepExtensionsUsed += 1;

        return {
          extendBy: 12,
          reason: "Applying one automatic extension to allow completion",
        };
      }

      return null;
    },
    buildSummary: ({ summary, state: runtimeState }) => {
      return (
        summary.trim() ||
        buildSummary(task, repoDisplayName, runtimeState.commandCount, undefined, taskType)
      );
    },
    formatRecoveryRequiredMessage: (recoveryReason) =>
      [
        "Execution has entered recovery mode.",
        "First action must be update_plan with a corrected, safer command strategy.",
        `Recovery reason: ${recoveryReason}`,
      ].join("\n"),
  });

  return {
    commandCount: result.commandCount,
    summary: result.summary,
    finalPlan: result.finalPlan,
  };
}
