import { gatewayId } from "~/constants/app";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
	IEnv,
	IUser,
	ParallelTaskOutput,
	ParallelTaskRun,
	ParallelTaskSchema,
	ParallelTaskSpec,
	ResearchOptions,
	ResearchProvider,
	ResearchResult,
	ResearchResultError,
	ResearchTaskHandle,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type ParallelResultPayload = {
	run: ParallelTaskRun;
	output: ParallelTaskOutput;
};

const FAILURE_STATUSES = new Set(["failed", "cancelled", "errored", "stopped"]);

const isResearchResultError = (
	value: ParallelTaskRun | ResearchResultError,
): value is ResearchResultError => {
	return (
		value?.status === "error" &&
		!Object.prototype.hasOwnProperty.call(value, "is_active")
	);
};

export class ParallelResearchProvider implements ResearchProvider {
	private env: IEnv;
	private user?: IUser;
	private apiKey?: string;
	private userSettingsRepo?: UserSettingsRepository;

	constructor(env: IEnv, user?: IUser) {
		this.env = env;
		this.user = user;

		if (user?.id && env.DB) {
			this.userSettingsRepo = new UserSettingsRepository(env);
		}
	}

	private async resolveApiKey(): Promise<string> {
		if (this.apiKey) {
			return this.apiKey;
		}

		if (this.user?.id && this.userSettingsRepo) {
			try {
				const userApiKey = await this.userSettingsRepo.getProviderApiKey(
					this.user.id,
					"parallel",
				);
				if (userApiKey) {
					this.apiKey = userApiKey;
					return userApiKey;
				}
			} catch (error) {
				if (
					error instanceof AssistantError &&
					(error.type === ErrorType.NOT_FOUND ||
						error.type === ErrorType.PARAMS_ERROR)
				) {
					// Ignore and fallback to env key
				} else {
					throw error;
				}
			}
		}

		const envKey = this.env.PARALLEL_API_KEY;
		if (!envKey) {
			throw new AssistantError(
				"PARALLEL_API_KEY is not set",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		this.apiKey = envKey;
		return envKey;
	}

	private getAiGatewayEndpoint(path = ""): string {
		return `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${gatewayId}/parallel/v1/tasks/runs${path}`;
	}

	private getParallelEndpoint(path = ""): string {
		return `https://api.parallel.ai/v1/tasks/runs${path}`;
	}

	private async getHeaders(): Promise<Record<string, string>> {
		const apiKey = await this.resolveApiKey();
		if (!this.env.AI_GATEWAY_TOKEN) {
			throw new AssistantError(
				"AI_GATEWAY_TOKEN is not set",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return {
			"Content-Type": "application/json",
			Accept: "application/json",
			"x-api-key": apiKey,
			"cf-aig-authorization": this.env.AI_GATEWAY_TOKEN,
			"cf-aig-metadata": JSON.stringify({
				userId: this.user?.id,
				email: this.user?.email,
				provider: "parallel",
				feature: "research",
			}),
		};
	}

	private normaliseSchema(schema?: ParallelTaskSchema) {
		if (!schema) {
			return undefined;
		}

		const normalised: ParallelTaskSchema = {
			type: schema.type,
		};

		if (schema.json_schema !== undefined) {
			normalised.json_schema = schema.json_schema;
		}

		if (schema.description !== undefined) {
			normalised.description = schema.description;
		}

		return normalised;
	}

	private normaliseTaskSpec(taskSpec?: ParallelTaskSpec) {
		if (!taskSpec) {
			return undefined;
		}

		const normalised: ParallelTaskSpec = {};

		const inputSchema = this.normaliseSchema(taskSpec.input_schema);
		if (inputSchema) {
			normalised.input_schema = inputSchema;
		}

		const outputSchema = this.normaliseSchema(taskSpec.output_schema);
		if (outputSchema) {
			normalised.output_schema = outputSchema;
		}

		return Object.keys(normalised).length > 0 ? normalised : undefined;
	}

	private sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async createResearchTask(
		input: unknown,
		options?: ResearchOptions,
	): Promise<ResearchTaskHandle | ResearchResultError> {
		const headers = await this.getHeaders();
		const payload: Record<string, unknown> = {
			input,
			processor: options?.processor ?? "ultra",
		};

		const taskSpec = this.normaliseTaskSpec(options?.task_spec);
		if (taskSpec) {
			payload.task_spec = taskSpec;
		}

		if (options?.enable_events !== undefined) {
			payload.enable_events = options.enable_events;
		}

		if (options?.metadata) {
			payload.metadata = options.metadata;
		}

		try {
			const endpoint = this.getAiGatewayEndpoint();
			const response = await fetch(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					status: "error",
					error: `Error creating research task: ${errorText}`,
				};
			}

			const run = (await response.json()) as ParallelTaskRun;
			if (!run?.run_id) {
				return {
					status: "error",
					error: "Parallel research task creation failed: missing run_id",
				};
			}

			return {
				provider: "parallel",
				run,
			};
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error creating research task: ${error.message}`
						: "Error creating research task",
			};
		}
	}

	async fetchResearchRun(
		runId: string,
	): Promise<ParallelTaskRun | ResearchResultError> {
		const headers = await this.getHeaders();

		try {
			const endpoint = this.getParallelEndpoint(`/${runId}`);
			const response = await fetch(endpoint, {
				method: "GET",
				headers,
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					"ParallelResearchProvider: Error fetching research run:",
					errorText,
				);
				return {
					status: "error",
					error: `Failed to fetch research run: ${errorText}`,
				};
			}

			const run = (await response.json()) as ParallelTaskRun;
			return run;
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error fetching research run: ${error.message}`
						: "Error fetching research run",
			};
		}
	}

	async fetchResearchResult(
		runId: string,
		options?: ResearchOptions,
	): Promise<ResearchResult> {
		const runStatus = await this.fetchResearchRun(runId);

		if (isResearchResultError(runStatus)) {
			return runStatus;
		}

		const normalizedStatus = runStatus.status?.toLowerCase?.();

		if (normalizedStatus && FAILURE_STATUSES.has(normalizedStatus)) {
			return {
				status: "error",
				error:
					runStatus.error ||
					`Parallel task ${normalizedStatus} for run ${runId}`,
			};
		}

		if (normalizedStatus !== "completed") {
			return {
				provider: "parallel",
				run: runStatus,
				warnings: runStatus.warnings ?? null,
			};
		}

		const headers = await this.getHeaders();
		const timeoutSeconds = Math.max(
			1,
			Math.min(60, options?.polling?.timeout_seconds ?? 5),
		);
		const endpoint = this.getParallelEndpoint(
			`/${runId}/result?timeout=${timeoutSeconds}`,
		);

		try {
			const response = await fetch(endpoint, {
				method: "GET",
				headers,
			});

			if (response.ok) {
				const data = (await response.json()) as ParallelResultPayload;
				return {
					provider: "parallel",
					run: data.run,
					output: data.output,
					warnings: data.run?.warnings ?? null,
				};
			}

			const errorText = await response.text();
			return {
				status: "error",
				error: `Failed to fetch research result: ${errorText}`,
			};
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error fetching research result: ${error.message}`
						: "Error fetching research result",
			};
		}
	}

	private async pollForResult(
		runId: string,
		options?: ResearchOptions,
	): Promise<ResearchResult> {
		const pollingOptions = options?.polling ?? {};
		const interval =
			pollingOptions.interval_ms && pollingOptions.interval_ms >= 500
				? pollingOptions.interval_ms
				: 5000;
		const maxAttempts = pollingOptions.max_attempts ?? 120;
		const startedAt = Date.now();

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const result = await this.fetchResearchResult(runId, options);

			if ("status" in result) {
				return result;
			}

			if (result.output) {
				return {
					provider: "parallel" as const,
					run: result.run as ParallelTaskRun,
					output: result.output as ParallelTaskOutput,
					warnings: result.warnings ?? result.run?.warnings ?? null,
					poll: {
						attempts: attempt,
						interval_ms: interval,
						timeout_seconds: Math.max(
							1,
							Math.min(60, pollingOptions.timeout_seconds ?? 5),
						),
						elapsed_ms: Date.now() - startedAt,
					},
				};
			}

			const runStatus = result.run as ParallelTaskRun;

			if (FAILURE_STATUSES.has(runStatus.status)) {
				const errorMessage =
					runStatus.error ||
					`Parallel research task ${runStatus.status.toLowerCase()}`;
				return {
					status: "error",
					error: errorMessage,
				};
			}

			if (runStatus.status === "completed") {
				// Should not happen without output, but guard anyway.
				return {
					provider: "parallel" as const,
					run: runStatus,
					warnings: runStatus.warnings ?? null,
				};
			}

			if (attempt < maxAttempts) {
				await this.sleep(interval);
			}
		}

		return {
			status: "error",
			error: `Timed out waiting for research result after ${maxAttempts} attempts.`,
		};
	}

	async performResearch(
		input: unknown,
		options?: ResearchOptions,
	): Promise<ResearchResult> {
		const creation = await this.createResearchTask(input, options);
		if ("status" in creation) {
			return creation;
		}

		const run = creation.run as ParallelTaskRun;
		return this.pollForResult(run.run_id, options);
	}
}
