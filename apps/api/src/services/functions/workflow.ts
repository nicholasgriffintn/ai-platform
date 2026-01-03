import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { handleFunctions } from "./index";

const logger = getLogger({ prefix: "services/functions/workflow" });

const MAX_WORKFLOW_STEPS = 20;
const MAX_PARALLEL_TASKS = 8;

type WorkflowStep = {
	function: string;
	args?: Record<string, any> | string;
	output_var?: string;
	on_error?: "stop" | "skip";
};

type WorkflowStepResult = {
	name: string;
	status: "success" | "error";
	output_var?: string;
	duration_ms: number;
	result_preview?: string;
	error?: string;
};

type WorkflowOutputs = Record<string, IFunctionResponse>;

const parseArgs = (args?: Record<string, any> | string) => {
	if (args === undefined) return {};
	if (typeof args === "string") {
		try {
			const parsed = JSON.parse(args);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				throw new AssistantError(
					"args must be a JSON object when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
			return parsed;
		} catch (error) {
			if (error instanceof AssistantError) throw error;
			throw new AssistantError(
				"args must be valid JSON when provided as a string",
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	if (!args || typeof args !== "object" || Array.isArray(args)) {
		throw new AssistantError("args must be an object", ErrorType.PARAMS_ERROR);
	}

	return args;
};

const resolveReference = (ref: string, outputs: WorkflowOutputs) => {
	const trimmed = ref.trim();
	if (!trimmed.startsWith("$")) return ref;

	const path = trimmed.slice(1);
	if (!path) {
		return outputs;
	}

	const parts = path.split(".");
	let current: any = outputs;

	for (const part of parts) {
		if (!current || typeof current !== "object" || !(part in current)) {
			throw new AssistantError(
				`Reference "${ref}" could not be resolved`,
				ErrorType.PARAMS_ERROR,
			);
		}
		current = current[part];
	}

	return current;
};

const resolveArgs = (input: any, outputs: WorkflowOutputs): any => {
	if (input === null || input === undefined) return input;
	if (typeof input === "string") return resolveReference(input, outputs);
	if (Array.isArray(input)) {
		return input.map((value) => resolveArgs(value, outputs));
	}
	if (typeof input === "object") {
		if (Object.keys(input).length === 1 && typeof input.$ref === "string") {
			return resolveReference(input.$ref, outputs);
		}
		const resolvedEntries = Object.entries(input).map(([key, value]) => [
			key,
			resolveArgs(value, outputs),
		]);
		return Object.fromEntries(resolvedEntries);
	}
	return input;
};

const summarizeResult = (result: IFunctionResponse) => {
	const content =
		typeof result.content === "string"
			? result.content
			: result.content
				? JSON.stringify(result.content)
				: "";

	if (!content) return undefined;

	const trimmed =
		content.length > 240 ? `${content.slice(0, 237)}...` : content;
	return trimmed;
};

const parseJsonArray = (value: unknown, label: string): any[] | undefined => {
	if (typeof value !== "string") {
		return value as any[] | undefined;
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			throw new AssistantError(
				`${label} must be a JSON array when provided as a string`,
				ErrorType.PARAMS_ERROR,
			);
		}
		return parsed;
	} catch (error) {
		if (error instanceof AssistantError) throw error;
		throw new AssistantError(
			`${label} must be valid JSON when provided as a string`,
			ErrorType.PARAMS_ERROR,
		);
	}
};

const parseJsonObject = (
	value: unknown,
	label: string,
): Record<string, any> | undefined => {
	if (typeof value !== "string") {
		return value as Record<string, any> | undefined;
	}

	try {
		const parsed = JSON.parse(value);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new AssistantError(
				`${label} must be a JSON object when provided as a string`,
				ErrorType.PARAMS_ERROR,
			);
		}
		return parsed;
	} catch (error) {
		if (error instanceof AssistantError) throw error;
		throw new AssistantError(
			`${label} must be valid JSON when provided as a string`,
			ErrorType.PARAMS_ERROR,
		);
	}
};

const normalizeCondition = (result: IFunctionResponse) => {
	if (typeof result.data?.result === "boolean") return result.data.result;
	if (typeof result.data?.value === "boolean") return result.data.value;
	if (typeof result.data?.condition === "boolean") return result.data.condition;
	if (typeof result.content === "string") {
		const normalized = result.content.trim().toLowerCase();
		if (normalized === "true") return true;
		if (normalized === "false") return false;
	}

	throw new AssistantError(
		"Condition function must return a boolean via data.result, data.value, data.condition, or content 'true'/'false'",
		ErrorType.PARAMS_ERROR,
	);
};

const runSequentialSteps = async ({
	completion_id,
	steps,
	req,
	app_url,
	conversationManager,
}: {
	completion_id: string;
	steps: WorkflowStep[];
	req: IRequest;
	app_url?: string;
	conversationManager?: ConversationManager;
}) => {
	const outputs: WorkflowOutputs = {};
	const stepResults: WorkflowStepResult[] = [];

	for (const step of steps) {
		const startedAt = Date.now();
		const onError = step.on_error || "stop";

		if (!step || typeof step !== "object") {
			throw new AssistantError(
				"Each step must be an object",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!step.function || typeof step.function !== "string") {
			throw new AssistantError(
				"Each step requires a function name",
				ErrorType.PARAMS_ERROR,
			);
		}

		try {
			const parsedArgs = parseArgs(step.args);
			const resolvedArgs = resolveArgs(parsedArgs, outputs);

			const result = await handleFunctions({
				completion_id,
				app_url,
				functionName: step.function,
				args: resolvedArgs,
				request: req,
				conversationManager,
			});

			if (step.output_var) {
				outputs[step.output_var] = result;
			}

			stepResults.push({
				name: step.function,
				status: "success",
				output_var: step.output_var,
				duration_ms: Date.now() - startedAt,
				result_preview: summarizeResult(result),
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			logger.warn("Workflow step failed", {
				step: step.function,
				error_message: errorMessage,
			});

			stepResults.push({
				name: step.function,
				status: "error",
				output_var: step.output_var,
				duration_ms: Date.now() - startedAt,
				error: errorMessage,
			});

			if (onError === "skip") {
				continue;
			}

			return {
				steps: stepResults,
				outputs,
				error: errorMessage,
			};
		}
	}

	return { steps: stepResults, outputs };
};

const runParallelSteps = async ({
	completion_id,
	steps,
	req,
	app_url,
	conversationManager,
}: {
	completion_id: string;
	steps: WorkflowStep[];
	req: IRequest;
	app_url?: string;
	conversationManager?: ConversationManager;
}) => {
	const outputs: WorkflowOutputs = {};
	const startedAt = Date.now();

	const tasks = steps.map(async (step) => {
		const stepStart = Date.now();
		try {
			if (!step || typeof step !== "object") {
				throw new AssistantError(
					"Each task must be an object",
					ErrorType.PARAMS_ERROR,
				);
			}
			if (!step.function || typeof step.function !== "string") {
				throw new AssistantError(
					"Each task requires a function name",
					ErrorType.PARAMS_ERROR,
				);
			}
			const parsedArgs = parseArgs(step.args);
			const resolvedArgs = resolveArgs(parsedArgs, outputs);
			const result = await handleFunctions({
				completion_id,
				app_url,
				functionName: step.function,
				args: resolvedArgs,
				request: req,
				conversationManager,
			});

			return {
				step,
				result,
				duration_ms: Date.now() - stepStart,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return {
				step,
				error: errorMessage,
				duration_ms: Date.now() - stepStart,
			};
		}
	});

	const settled = await Promise.all(tasks);
	const stepResults: WorkflowStepResult[] = [];

	for (const entry of settled) {
		if ("result" in entry) {
			if (entry.step.output_var) {
				outputs[entry.step.output_var] = entry.result;
			}

			stepResults.push({
				name: entry.step.function,
				status: "success",
				output_var: entry.step.output_var,
				duration_ms: entry.duration_ms,
				result_preview: summarizeResult(entry.result),
			});
		} else {
			stepResults.push({
				name: entry.step.function,
				status: "error",
				output_var: entry.step.output_var,
				duration_ms: entry.duration_ms,
				error: entry.error,
			});
		}
	}

	return { steps: stepResults, outputs, duration_ms: Date.now() - startedAt };
};

export const compose_functions: IFunction = {
	name: "compose_functions",
	description:
		"Chain multiple tool calls together with data passing. Use output_var to name a step's result, then reference it via $output_var or { $ref: '$output_var.data' } in later args.",
	type: "normal",
	isDefault: true,
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			steps: {
				type: "array",
				description:
					"Ordered list of steps to execute. Each step must include { function } and may include { args, output_var, on_error }. args can reference prior outputs via $output_var or { $ref: '$output_var.data' }. on_error can be 'stop' or 'skip'.",
				items: {
					type: "object",
					description: "A tool call step definition",
				},
			},
		},
		required: ["steps"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		const steps = parseJsonArray(args?.steps, "steps");
		if (!Array.isArray(steps) || steps.length === 0) {
			throw new AssistantError(
				"steps must be a non-empty array",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (steps.length > MAX_WORKFLOW_STEPS) {
			throw new AssistantError(
				`steps exceeds maximum of ${MAX_WORKFLOW_STEPS}`,
				ErrorType.PARAMS_ERROR,
			);
		}

		const {
			steps: stepResults,
			outputs,
			error,
		} = await runSequentialSteps({
			completion_id,
			steps,
			req,
			app_url,
			conversationManager,
		});

		const failed = Boolean(error);
		return {
			name: "compose_functions",
			status: failed ? "error" : "success",
			content: failed
				? "Workflow stopped due to a step error"
				: "Workflow completed",
			data: {
				steps: stepResults,
				outputs,
				error,
			},
		};
	},
};

export const if_then_else: IFunction = {
	name: "if_then_else",
	description:
		"Run a condition tool and branch into then_steps or else_steps. Condition must return a boolean via data.result, data.value, data.condition, or content 'true'/'false'.",
	type: "normal",
	isDefault: true,
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			condition: {
				type: "object",
				description:
					"Condition step { function, args }. Must return a boolean via data.result/data.value/data.condition or content 'true'/'false'.",
			},
			then_steps: {
				type: "array",
				description:
					"Steps to execute when condition is true. Each step must include { function } and may include { args, output_var, on_error }. args can reference prior outputs via $output_var or { $ref: '$output_var.data' }.",
				items: { type: "object" },
			},
			else_steps: {
				type: "array",
				description:
					"Steps to execute when condition is false. Each step must include { function } and may include { args, output_var, on_error }. args can reference prior outputs via $output_var or { $ref: '$output_var.data' }.",
				items: { type: "object" },
			},
		},
		required: ["condition", "then_steps", "else_steps"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		const condition = parseJsonObject(args?.condition, "condition");
		const thenSteps = parseJsonArray(args?.then_steps, "then_steps");
		const elseSteps = parseJsonArray(args?.else_steps, "else_steps");

		if (!condition || typeof condition !== "object") {
			throw new AssistantError(
				"condition must be an object with function and args",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!Array.isArray(thenSteps) || !Array.isArray(elseSteps)) {
			throw new AssistantError(
				"then_steps and else_steps must be arrays",
				ErrorType.PARAMS_ERROR,
			);
		}

		let branch = "then";
		let conditionValue = false;
		let conditionError = "";
		let conditionResult: IFunctionResponse | null = null;

		try {
			if (!condition.function || typeof condition.function !== "string") {
				throw new AssistantError(
					"condition.function must be a string",
					ErrorType.PARAMS_ERROR,
				);
			}

			const parsedArgs = parseArgs(condition.args);
			const resolvedArgs = resolveArgs(parsedArgs, {});

			conditionResult = await handleFunctions({
				completion_id,
				app_url,
				functionName: condition.function,
				args: resolvedArgs,
				request: req,
				conversationManager,
			});

			conditionValue = normalizeCondition(conditionResult);
			branch = conditionValue ? "then" : "else";
		} catch (error) {
			conditionError =
				error instanceof Error ? error.message : "Unknown condition error";
		}

		if (conditionError) {
			return {
				name: "if_then_else",
				status: "error",
				content: "Condition could not be evaluated",
				data: {
					condition: {
						name: condition.function,
						status: "error",
					},
					error: conditionError,
				},
			};
		}

		const chosenSteps = conditionValue ? thenSteps : elseSteps;

		if (chosenSteps.length > MAX_WORKFLOW_STEPS) {
			throw new AssistantError(
				`steps exceeds maximum of ${MAX_WORKFLOW_STEPS}`,
				ErrorType.PARAMS_ERROR,
			);
		}

		const branchResults = await runSequentialSteps({
			completion_id,
			steps: chosenSteps,
			req,
			app_url,
			conversationManager,
		});

		return {
			name: "if_then_else",
			status: branchResults.error ? "error" : "success",
			content: branchResults.error
				? "Branch execution failed"
				: `Condition evaluated to ${conditionValue}`,
			data: {
				condition: {
					status: "success",
					name: condition.function,
					result_preview: conditionResult
						? summarizeResult(conditionResult)
						: undefined,
				},
				branch,
				steps: branchResults.steps,
				outputs: branchResults.outputs,
				error: branchResults.error,
			},
		};
	},
};

export const parallel_execute: IFunction = {
	name: "parallel_execute",
	description:
		"Execute multiple tool calls concurrently. Each task must include { function } and may include { args, output_var }. args can reference prior outputs via $output_var or { $ref: '$output_var.data' }.",
	type: "normal",
	isDefault: true,
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			tasks: {
				type: "array",
				description:
					"Tasks to run in parallel. Each task must include { function } and may include { args, output_var }. args can reference prior outputs via $output_var or { $ref: '$output_var.data' }.",
				items: {
					type: "object",
					description: "Parallel task definition",
				},
			},
		},
		required: ["tasks"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		const tasks = parseJsonArray(args?.tasks, "tasks");
		if (!Array.isArray(tasks) || tasks.length === 0) {
			throw new AssistantError(
				"tasks must be a non-empty array",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (tasks.length > MAX_PARALLEL_TASKS) {
			throw new AssistantError(
				`tasks exceeds maximum of ${MAX_PARALLEL_TASKS}`,
				ErrorType.PARAMS_ERROR,
			);
		}

		const { steps, outputs, duration_ms } = await runParallelSteps({
			completion_id,
			steps: tasks,
			req,
			app_url,
			conversationManager,
		});

		const failures = steps.filter((step) => step.status === "error");

		return {
			name: "parallel_execute",
			status: failures.length > 0 ? "error" : "success",
			content:
				failures.length > 0
					? `${failures.length} task(s) failed in parallel execution`
					: "Parallel execution completed",
			data: {
				steps,
				outputs,
				duration_ms,
				failed_count: failures.length,
			},
		};
	},
};
