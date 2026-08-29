import { AGENT_CONTROL_TOOL_NAMES, FINISH_TOOL_NAME, UPDATE_PLAN_TOOL_NAME } from "./control-tools";
import type {
  AgentConfig,
  AgentEvent,
  AgentGoalOutcome,
  AgentLoopResult,
  AgentLoopState,
  AgentToolCall,
  ExecuteAgentLoopParams,
} from "./types";
import { truncateForModel } from "./utils";

const DEFAULT_CONFIG: AgentConfig = {
  maxSteps: 48,
  maxStepExtensions: 2,
  maxRecoveryReplans: 4,
  maxConsecutiveTurnFailures: 3,
  maxObservationChars: 5000,
};

function defaultGetCommandCount(state: AgentLoopState): number {
  return typeof state.commandCount === "number" ? state.commandCount : 0;
}

function defaultMissingToolCallMessage(errorMessage: string): string {
  return [
    "Your previous response could not be used.",
    `Reason: ${errorMessage}`,
    "Respond with a tool call.",
    `If uncertain, call ${UPDATE_PLAN_TOOL_NAME} first to revise the next steps.`,
  ].join("\n");
}

function defaultRecoveryRequiredMessage(recoveryReason: string): string {
  return [
    "Execution has entered recovery mode.",
    `First action must be ${UPDATE_PLAN_TOOL_NAME} with a corrected, safer strategy.`,
    `Recovery reason: ${recoveryReason}`,
  ].join("\n");
}

function defaultRecoveryEnforcementMessage(recoveryReason: string): string {
  return [
    "Recovery mode is active after recent failures.",
    `Recovery reason: ${recoveryReason}`,
    `Before any other action, call ${UPDATE_PLAN_TOOL_NAME} with a revised approach and safer next steps.`,
  ].join("\n");
}

function defaultPlanUpdatedMessage(plan: string): string {
  return ["Plan updated.", "", "Current plan:", plan, "", "Choose the next action."].join("\n");
}

function readStringArgument(toolCall: AgentToolCall, key: string): string {
  const value = toolCall.arguments[key];

  return typeof value === "string" ? value : "";
}

export async function executeAgentLoop<
  TShared = unknown,
  TState extends AgentLoopState = AgentLoopState,
>(params: ExecuteAgentLoopParams<TShared, TState>): Promise<AgentLoopResult> {
  const config: AgentConfig = {
    ...DEFAULT_CONFIG,
    ...params.config,
  };

  const emit = params.emit ?? (async (_event: AgentEvent) => {});
  const guardExecution = params.guardExecution ?? (async (_abortMessage: string) => {});
  const getCommandCount = params.getCommandCount ?? defaultGetCommandCount;
  const formatMissingToolCallMessage =
    params.formatMissingToolCallMessage ?? defaultMissingToolCallMessage;
  const formatRecoveryRequiredMessage =
    params.formatRecoveryRequiredMessage ?? defaultRecoveryRequiredMessage;
  const formatRecoveryEnforcementMessage =
    params.formatRecoveryEnforcementMessage ?? defaultRecoveryEnforcementMessage;
  const formatPlanUpdatedMessage = params.formatPlanUpdatedMessage ?? defaultPlanUpdatedMessage;
  const shouldAbortOnTurnError = params.shouldAbortOnTurnError ?? (() => false);

  const messages = params.initialMessages;
  let currentPlan = params.initialPlan;
  let consecutiveTurnFailures = 0;
  let recoveryReplans = 0;
  let requiresPlanRecovery = false;
  let recoveryReason: string | undefined;

  const beginPlanRecovery = (reason: string) => {
    recoveryReplans += 1;
    if (recoveryReplans > config.maxRecoveryReplans) {
      throw new Error(`Agent exhausted recovery replans (${config.maxRecoveryReplans})`);
    }

    requiresPlanRecovery = true;
    recoveryReason = truncateForModel(reason, config.maxObservationChars);
    consecutiveTurnFailures = 0;

    params.onPlanRecovery?.({
      reason: recoveryReason,
      recoveryReplans,
      state: params.state,
    });
  };

  let maxSteps = config.maxSteps;
  let step = 1;
  let stepExtensions = 0;

  const tryExtendStepBudget = async (): Promise<boolean> => {
    if (
      typeof params.onStepBudgetExceeded !== "function" ||
      stepExtensions >= config.maxStepExtensions
    ) {
      return false;
    }

    const extension = await params.onStepBudgetExceeded({
      step,
      maxSteps,
      currentPlan,
      messages,
      shared: params.shared,
      state: params.state,
    });

    if (!extension || !Number.isFinite(extension.extendBy) || extension.extendBy <= 0) {
      return false;
    }

    const extendBy = Math.max(1, Math.floor(extension.extendBy));

    maxSteps += extendBy;
    stepExtensions += 1;
    await emit({
      type: "agent_step_budget_extended",
      agentStep: step,
      maxSteps,
      extendedBy: extendBy,
      message: extension.reason || `Agent step budget extended by ${extendBy} steps.`,
    });

    return true;
  };

  const finishLoop = async (
    rawSummary: string,
    outcome: AgentGoalOutcome | undefined,
  ): Promise<AgentLoopResult> => {
    const summary =
      (await params.buildSummary?.({
        summary: rawSummary,
        state: params.state,
        currentPlan,
        shared: params.shared,
      })) ?? rawSummary;

    await emit({
      type: "agent_finished",
      agentStep: step,
      commandCount: getCommandCount(params.state),
      plan: truncateForModel(currentPlan, 1000),
      summary,
    });

    return {
      summary,
      finalPlan: currentPlan,
      commandCount: getCommandCount(params.state),
      stepsTaken: step,
      goalOutcome: outcome,
    };
  };

  while (true) {
    if (step > maxSteps) {
      const extended = await tryExtendStepBudget();

      if (extended) {
        continue;
      }

      await emit({
        type: "agent_step_budget_exhausted",
        agentStep: step,
        maxSteps,
        error: `Agent exceeded maximum step budget (${maxSteps})`,
      });
      throw new Error(`Agent exceeded maximum step budget (${maxSteps})`);
    }

    await guardExecution("Agent run cancelled during execution");

    await emit({
      type: "agent_step_started",
      agentStep: step,
      commandCount: getCommandCount(params.state),
    });

    let turn: Awaited<ReturnType<typeof params.resolveTurn>>;

    try {
      turn = await params.resolveTurn({
        step,
        messages,
        shared: params.shared,
        currentPlan,
        requiresPlanRecovery,
        recoveryReason,
      });
      consecutiveTurnFailures = 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to produce an agent turn";

      if (shouldAbortOnTurnError(error)) {
        await emit({
          type: "agent_turn_failed",
          agentStep: step,
          error: truncateForModel(errorMessage, config.maxObservationChars),
        });
        throw error;
      }

      consecutiveTurnFailures += 1;
      await emit({
        type: "agent_turn_invalid",
        agentStep: step,
        error: truncateForModel(errorMessage, config.maxObservationChars),
      });
      messages.push({
        role: "user",
        content: formatMissingToolCallMessage(
          truncateForModel(errorMessage, config.maxObservationChars),
        ),
      });

      if (consecutiveTurnFailures >= config.maxConsecutiveTurnFailures && !requiresPlanRecovery) {
        beginPlanRecovery(
          `Model produced ${config.maxConsecutiveTurnFailures} unusable turns in a row.`,
        );
        messages.push({
          role: "user",
          content: formatRecoveryRequiredMessage(recoveryReason ?? "Repeated execution failures."),
        });
      }

      step += 1;
      continue;
    }

    if (turn.assistantMessage) {
      messages.push(turn.assistantMessage);
    }

    const planCall = turn.toolCalls.find((toolCall) => toolCall.name === UPDATE_PLAN_TOOL_NAME);
    const finishCall = turn.toolCalls.find((toolCall) => toolCall.name === FINISH_TOOL_NAME);
    const actionCalls = turn.toolCalls.filter(
      (toolCall) => !AGENT_CONTROL_TOOL_NAMES.has(toolCall.name),
    );

    if (requiresPlanRecovery && !planCall) {
      await emit({
        type: "agent_turn_invalid",
        agentStep: step,
        error: `Recovery mode requires ${UPDATE_PLAN_TOOL_NAME} before other actions.`,
        toolNames: turn.toolCalls.map((toolCall) => toolCall.name),
      });
      messages.push({
        role: "user",
        content: formatRecoveryEnforcementMessage(recoveryReason ?? "Repeated execution failures."),
      });
      step += 1;
      continue;
    }

    await emit({
      type: "agent_turn",
      agentStep: step,
      toolNames: turn.toolCalls.map((toolCall) => toolCall.name),
    });

    if (planCall) {
      currentPlan = truncateForModel(readStringArgument(planCall, "plan"), 2500);
      requiresPlanRecovery = false;
      recoveryReason = undefined;
      await emit({
        type: "plan_updated",
        agentStep: step,
        plan: currentPlan,
      });
      messages.push({
        role: "user",
        content: formatPlanUpdatedMessage(currentPlan),
      });
    }

    if (actionCalls.length > 0) {
      await params.executeToolCalls(actionCalls, {
        step,
        messages,
        shared: params.shared,
        state: params.state,
        emit,
        guardExecution,
        beginPlanRecovery,
      });
    }

    const hasFinished = Boolean(finishCall) || turn.toolCalls.length === 0;

    if (hasFinished) {
      const rawSummary = finishCall ? readStringArgument(finishCall, "summary") : (turn.text ?? "");
      const assessment = (await params.assessFinish?.({
        summary: rawSummary,
        step,
        messages,
        shared: params.shared,
        state: params.state,
      })) ?? { allow: true };

      if (assessment.allow) {
        return finishLoop(rawSummary, assessment.outcome);
      }

      await emit({
        type: "agent_finish_rejected",
        agentStep: step,
        reason: assessment.instruction,
      });
      messages.push({
        role: "user",
        content: truncateForModel(
          `[automated check, not a message from the user] ${
            assessment.instruction ?? "The objective is not satisfied yet. Continue working."
          }`,
          config.maxObservationChars,
        ),
      });
    }

    step += 1;
  }
}
