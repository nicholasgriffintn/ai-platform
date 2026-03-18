import type {
	ActionHandler,
	AgentConfig,
	AgentDecision,
	AgentEvent,
	AgentLoopResult,
	AgentLoopState,
	ExecuteAgentLoopParams,
} from "./types";
import { truncateForModel } from "./utils";

const DEFAULT_CONFIG: AgentConfig = {
	maxSteps: 48,
	maxStepExtensions: 2,
	maxRecoveryReplans: 4,
	maxConsecutiveDecisionFailures: 3,
	maxObservationChars: 5000,
};

function defaultGetCommandCount(state: AgentLoopState): number {
	return typeof state.commandCount === "number" ? state.commandCount : 0;
}

function defaultSerializeDecision(decision: AgentDecision): {
	role: "assistant";
	content: string;
} {
	return {
		role: "assistant",
		content: JSON.stringify(decision),
	};
}

function defaultInvalidDecisionMessage(errorMessage: string): string {
	return [
		"Your previous response could not be used as a valid decision.",
		`Error: ${errorMessage}`,
		"Respond with exactly one JSON object using a supported action.",
		"If uncertain, use update_plan first to revise the next steps.",
	].join("\n");
}

function defaultRecoveryRequiredMessage(recoveryReason: string): string {
	return [
		"Execution has entered recovery mode.",
		"First action must be update_plan with a corrected, safer strategy.",
		`Recovery reason: ${recoveryReason}`,
	].join("\n");
}

function defaultRecoveryEnforcementMessage(recoveryReason: string): string {
	return [
		"Recovery mode is active after recent failures.",
		`Recovery reason: ${recoveryReason}`,
		"Before any other action, return update_plan with a revised approach and safer next steps.",
	].join("\n");
}

function defaultPlanUpdatedMessage(plan: string): string {
	return [
		"Plan updated.",
		"",
		"Current plan:",
		plan,
		"",
		"Choose the next action.",
	].join("\n");
}

function resolveHandler<TShared, TState extends AgentLoopState>(
	handlers: ActionHandler<any, TShared, TState>[],
	decision: AgentDecision,
): ActionHandler<any, TShared, TState> | null {
	for (const handler of handlers) {
		if (handler.canHandle(decision)) {
			return handler;
		}
	}

	return null;
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
	const guardExecution =
		params.guardExecution ?? (async (_abortMessage: string) => {});
	const getCommandCount = params.getCommandCount ?? defaultGetCommandCount;
	const serializeDecision =
		params.serializeDecision ??
		((decision: AgentDecision) => defaultSerializeDecision(decision));
	const formatInvalidDecisionMessage =
		params.formatInvalidDecisionMessage ?? defaultInvalidDecisionMessage;
	const formatRecoveryRequiredMessage =
		params.formatRecoveryRequiredMessage ?? defaultRecoveryRequiredMessage;
	const formatRecoveryEnforcementMessage =
		params.formatRecoveryEnforcementMessage ??
		defaultRecoveryEnforcementMessage;
	const formatPlanUpdatedMessage =
		params.formatPlanUpdatedMessage ?? defaultPlanUpdatedMessage;

	const messages = params.initialMessages;
	let currentPlan = params.initialPlan;
	let consecutiveDecisionFailures = 0;
	let recoveryReplans = 0;
	let requiresPlanRecovery = false;
	let recoveryReason: string | undefined;

	const beginPlanRecovery = (reason: string) => {
		recoveryReplans += 1;
		if (recoveryReplans > config.maxRecoveryReplans) {
			throw new Error(
				`Agent exhausted recovery replans (${config.maxRecoveryReplans})`,
			);
		}

		requiresPlanRecovery = true;
		recoveryReason = truncateForModel(reason, config.maxObservationChars);
		consecutiveDecisionFailures = 0;

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
		if (
			!extension ||
			!Number.isFinite(extension.extendBy) ||
			extension.extendBy <= 0
		) {
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
			message:
				extension.reason || `Agent step budget extended by ${extendBy} steps.`,
		});
		return true;
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

		let decisionResult: Awaited<ReturnType<typeof params.resolveDecision>>;
		try {
			decisionResult = await params.resolveDecision({
				step,
				messages,
				shared: params.shared,
				currentPlan,
				requiresPlanRecovery,
				recoveryReason,
			});
			consecutiveDecisionFailures = 0;
		} catch (error) {
			consecutiveDecisionFailures += 1;
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to parse or produce an agent decision";
			await emit({
				type: "agent_decision_invalid",
				agentStep: step,
				error: truncateForModel(errorMessage, config.maxObservationChars),
			});
			messages.push({
				role: "user",
				content: formatInvalidDecisionMessage(
					truncateForModel(errorMessage, config.maxObservationChars),
				),
			});

			if (
				consecutiveDecisionFailures >= config.maxConsecutiveDecisionFailures &&
				!requiresPlanRecovery
			) {
				beginPlanRecovery(
					`Model produced ${config.maxConsecutiveDecisionFailures} unusable decisions in a row.`,
				);
				messages.push({
					role: "user",
					content: formatRecoveryRequiredMessage(
						recoveryReason ?? "Repeated execution failures.",
					),
				});
			}
			step += 1;
			continue;
		}

		const { decision } = decisionResult;
		if (requiresPlanRecovery && decision.action !== "update_plan") {
			await emit({
				type: "agent_decision_invalid",
				agentStep: step,
				error: "Recovery mode requires update_plan before other actions.",
				action: decision.action,
			});
			messages.push({
				role: "user",
				content: formatRecoveryEnforcementMessage(
					recoveryReason ?? "Repeated execution failures.",
				),
			});
			step += 1;
			continue;
		}

		await emit({
			type: "agent_decision",
			agentStep: step,
			action: decision.action,
			reasoning: decision.reasoning,
		});

		messages.push(
			decisionResult.assistantMessage ??
				serializeDecision(decision, decisionResult.rawResponse),
		);

		if (decision.action === "update_plan") {
			currentPlan = truncateForModel(decision.plan, 2500);
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
			step += 1;
			continue;
		}

		if (decision.action === "finish") {
			const summary =
				(await params.buildSummary?.({
					decision,
					state: params.state,
					currentPlan,
					shared: params.shared,
				})) ?? decision.summary;

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
			};
		}

		const handler = resolveHandler(params.handlers, decision);
		if (!handler) {
			throw new Error(
				`No action handler registered for action "${decision.action}"`,
			);
		}

		await handler.execute(decision, {
			step,
			messages,
			shared: params.shared,
			state: params.state,
			emit,
			guardExecution,
			beginPlanRecovery,
		});

		step += 1;
	}
}
