import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
	IEnv,
	IUser,
	ExaTaskRun,
	ExaTaskOutput,
	ResearchOptions,
	ResearchProvider,
	ResearchResult,
	ResearchResultError,
	ResearchTaskHandle,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type ExaResultPayload = {
	researchId: string;
	status: string;
	model?: string;
	instructions?: string;
	createdAt?: string;
	completedAt?: string;
	output?: unknown;
	outputSchema?: Record<string, unknown>;
	citations?: Array<{
		title?: string;
		url?: string;
		author?: string;
		publishedDate?: string;
		text?: string;
		highlights?: string[];
	}>;
	usage?: {
		searches?: number;
		pagesRead?: number;
		reasoningTokens?: number;
	};
	error?: string;
};

const FAILURE_STATUSES = new Set(["failed", "cancelled", "errored", "stopped"]);

const isResearchResultError = (
	value: ExaTaskRun | ResearchResultError,
): value is ResearchResultError => {
	return value?.status === "error" && !("research_id" in value);
};

export class ExaResearchProvider implements ResearchProvider {
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
					"exa",
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

		const envKey = this.env.EXA_API_KEY;
		if (!envKey) {
			throw new AssistantError(
				"EXA_API_KEY is not set",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		this.apiKey = envKey;
		return envKey;
	}

	private getExaEndpoint(path = ""): string {
		return `https://api.exa.ai/research/v1${path}`;
	}

	private async getHeaders(): Promise<Record<string, string>> {
		const apiKey = await this.resolveApiKey();

		return {
			"Content-Type": "application/json",
			Accept: "application/json",
			"x-api-key": apiKey,
		};
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
			instructions: typeof input === "string" ? input : JSON.stringify(input),
			model: options?.model ?? "exa-research",
		};

		if (options?.exa_spec?.output_schema) {
			payload.outputSchema = options.exa_spec.output_schema;
		}

		try {
			const endpoint = this.getExaEndpoint();
			const response = await fetch(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					status: "error",
					error: `Error creating Exa research task: ${errorText}`,
				};
			}

			const result = (await response.json()) as ExaResultPayload;
			if (!result?.researchId) {
				return {
					status: "error",
					error: "Exa research task creation failed: missing researchId",
				};
			}

			const run: ExaTaskRun = {
				research_id: result.researchId,
				status: result.status || "pending",
				model: result.model,
				created_at: result.createdAt,
			};

			return {
				provider: "exa",
				run,
			};
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error creating Exa research task: ${error.message}`
						: "Error creating Exa research task",
			};
		}
	}

	async fetchResearchRun(
		runId: string,
	): Promise<ExaTaskRun | ResearchResultError> {
		const headers = await this.getHeaders();

		try {
			const endpoint = this.getExaEndpoint(`/${runId}`);
			const response = await fetch(endpoint, {
				method: "GET",
				headers,
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					"ExaResearchProvider: Error fetching research run:",
					errorText,
				);
				return {
					status: "error",
					error: `Failed to fetch Exa research run: ${errorText}`,
				};
			}

			const result = (await response.json()) as ExaResultPayload;
			const run: ExaTaskRun = {
				research_id: result.researchId,
				status: result.status,
				model: result.model,
				created_at: result.createdAt,
				completed_at: result.completedAt,
				error: result.error,
			};

			return run;
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error fetching Exa research run: ${error.message}`
						: "Error fetching Exa research run",
			};
		}
	}

	async fetchResearchResult(
		runId: string,
		_options?: ResearchOptions,
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
					runStatus.error || `Exa task ${normalizedStatus} for run ${runId}`,
			};
		}

		if (normalizedStatus !== "completed") {
			return {
				provider: "exa",
				run: runStatus,
				warnings: runStatus.warnings ?? null,
			};
		}

		const headers = await this.getHeaders();
		const endpoint = this.getExaEndpoint(`/${runId}`);

		try {
			const response = await fetch(endpoint, {
				method: "GET",
				headers,
			});

			if (response.ok) {
				const data = (await response.json()) as ExaResultPayload;

				const run: ExaTaskRun = {
					research_id: data.researchId,
					status: data.status,
					model: data.model,
					created_at: data.createdAt,
					completed_at: data.completedAt,
					error: data.error,
				};

				const output: ExaTaskOutput = {
					content: data.output,
					citations: data.citations,
					usage: data.usage,
				};

				return {
					provider: "exa",
					run,
					output,
					warnings: null,
				};
			}

			const errorText = await response.text();
			return {
				status: "error",
				error: `Failed to fetch Exa research result: ${errorText}`,
			};
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error fetching Exa research result: ${error.message}`
						: "Error fetching Exa research result",
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
					provider: "exa" as const,
					run: result.run as ExaTaskRun,
					output: result.output,
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

			const runStatus = result.run as ExaTaskRun;

			if (FAILURE_STATUSES.has(runStatus.status)) {
				const errorMessage =
					runStatus.error || `Exa research task ${runStatus.status}`;
				return {
					status: "error",
					error: errorMessage,
				};
			}

			if (runStatus.status === "completed") {
				// Should not happen without output, but guard anyway
				return {
					provider: "exa" as const,
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
			error: `Timed out waiting for Exa research result after ${maxAttempts} attempts.`,
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

		const run = creation.run as ExaTaskRun;
		return this.pollForResult(run.research_id, options);
	}
}
