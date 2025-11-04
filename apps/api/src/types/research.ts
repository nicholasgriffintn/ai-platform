export type ResearchProviderName = "parallel" | "exa";

export interface ParallelTaskCitation {
	title?: string | null;
	url?: string | null;
	excerpts?: string[];
}

export interface ParallelTaskFieldBasis {
	field: string;
	reasoning?: string;
	confidence?: string;
	citations?: ParallelTaskCitation[];
}

export interface ParallelTaskOutput {
	content: unknown;
	basis?: ParallelTaskFieldBasis[];
	type?: string;
}

export interface ParallelTaskRun {
	run_id: string;
	status: string;
	is_active: boolean;
	warnings?: string[] | null;
	processor: string;
	metadata?: Record<string, unknown> | null;
	created_at: string;
	modified_at: string;
	error?: string | null;
	taskgroup_id?: string | null;
}

export interface ResearchPollMetadata {
	attempts: number;
	interval_ms: number;
	timeout_seconds: number;
	elapsed_ms: number;
}

export interface ParallelResearchResult {
	provider: "parallel";
	run: ParallelTaskRun;
	output?: ParallelTaskOutput;
	poll?: ResearchPollMetadata;
	warnings?: string[] | null;
}

export interface ExaCitation {
	title?: string | null;
	url?: string | null;
	author?: string | null;
	publishedDate?: string | null;
	text?: string | null;
	highlights?: string[];
}

export interface ExaTaskRun {
	research_id: string;
	status: string;
	model?: string;
	created_at?: string;
	completed_at?: string;
	error?: string | null;
	warnings?: string[] | null;
}

export interface ExaTaskOutput {
	content?: unknown;
	markdown?: string;
	citations?: ExaCitation[];
	usage?: {
		searches?: number;
		pagesRead?: number;
		reasoningTokens?: number;
	};
}

export interface ExaResearchResult {
	provider: "exa";
	run: ExaTaskRun;
	output?: ExaTaskOutput;
	poll?: ResearchPollMetadata;
	warnings?: string[] | null;
}

export interface ResearchResultError {
	status: "error";
	error: string;
}

export type ResearchResult = ParallelResearchResult | ExaResearchResult | ResearchResultError;

export interface ResearchTaskHandle {
	provider: ResearchProviderName;
	run: ParallelTaskRun | ExaTaskRun;
}

export interface ParallelTaskSchema {
	type: "json" | "text" | "auto";
	json_schema?: Record<string, unknown>;
	description?: string;
}

export interface ParallelTaskSpec {
	input_schema?: ParallelTaskSchema;
	output_schema?: ParallelTaskSchema;
}

export interface ResearchPollingOptions {
	interval_ms?: number;
	max_attempts?: number;
	timeout_seconds?: number;
}

export interface ExaTaskSpec {
	output_schema?: Record<string, unknown>;
}

export interface ResearchOptions {
	// Parallel-specific options
	processor?: string;
	task_spec?: ParallelTaskSpec;
	enable_events?: boolean;

	// Exa-specific options
	model?: string; // exa-research or exa-research-pro
	exa_spec?: ExaTaskSpec;

	// Common options
	metadata?: Record<string, unknown>;
	polling?: ResearchPollingOptions;
}

export interface ResearchProvider {
	createResearchTask(
		input: unknown,
		options?: ResearchOptions,
	): Promise<ResearchTaskHandle | ResearchResultError>;
	fetchResearchRun(
		runId: string,
	): Promise<ParallelTaskRun | ExaTaskRun | ResearchResultError>;
	fetchResearchResult(
		runId: string,
		options?: ResearchOptions,
	): Promise<ResearchResult>;
	performResearch(
		input: unknown,
		options?: ResearchOptions,
	): Promise<ResearchResult>;
}
