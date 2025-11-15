import type { ServiceContext } from "../lib/context/serviceContext";
import type {
	IEnv,
	ReasoningEffortLevel,
	RequireAtLeastOne,
	VerbosityLevel,
} from "./shared";
import type { IUser } from "./user";

export type Platform = "web" | "mobile" | "api" | "dynamic-apps";

export type ContentType =
	| "text"
	| "image_url"
	| "audio_url"
	| "video_url"
	| "input_audio"
	| "thinking"
	| "document_url"
	| "markdown_document"
	| "tool_result";
export type ChatRole = "user" | "assistant" | "tool" | "developer" | "system";
export type ChatMode = "normal" | "local" | "remote" | "no_system" | "agent";

export interface ReasoningControls {
	effort?: ReasoningEffortLevel;
}

export type MessageContent = {
	type: ContentType;
	text?: string;
	image_url?: {
		url: string;
	};
	audio_url?: {
		url: string;
	};
	video_url?: {
		url: string;
	};
	input_audio?: {
		data?: string;
		format?: "wav" | "mp3";
	};
	document_url?: {
		url: string;
		name?: string;
	};
	markdown_document?: {
		markdown: string;
		name?: string;
	};
	thinking?: string;
	signature?: string;
	image?: number[] | string;
	tool_use_id?: string;
	id?: string;
	name?: string;
	content?: string;
	input?: string | Record<string, string | number | boolean>;
	cache_control?: {
		type: "ephemeral";
	};
};

export type Attachment = {
	type: "image" | "document" | "markdown_document" | "audio" | "video";
	url?: string;
	detail?: "low" | "high";
	name?: string;
	markdown?: string;
};

export type AsyncInvocationStatus = "in_progress" | "completed" | "failed";

export interface AsyncInvocationContentHints {
	placeholder?: MessageContent[];
	progress?: MessageContent[];
	failure?: MessageContent[];
}

export interface AsyncInvocationPollConfig {
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, any>;
	query?: Record<string, string>;
	intervalMs?: number;
}

export interface AsyncInvocationData {
	provider: string;
	/**
	 * Provider-defined unique identifier for this async task. The client only needs to echo this back.
	 */
	id: string;
	/**
	 * Optional classification that helps the server determine the correct polling strategy.
	 */
	type?: string;
	poll?: AsyncInvocationPollConfig;
	pollIntervalMs?: number;
	status?: AsyncInvocationStatus | string;
	lastCheckedAt?: number;
	completedAt?: number;
	initialResponse?: Record<string, any>;
	/**
	 * Arbitrary provider context needed to resume polling (e.g. region, model version).
	 */
	context?: Record<string, any>;
	/**
	 * Optional UX hints so the UI can present nicer copy while polling or when failures happen.
	 */
	contentHints?: AsyncInvocationContentHints;
	[key: string]: any;
}

export interface MessageDataPayload extends Record<string, any> {
	asyncInvocation?: AsyncInvocationData;
	error?: string;
}

export interface Message {
	role: ChatRole;
	name?: string;
	tool_calls?: Record<string, any>[];
	parts?: {
		text: string;
	}[];
	content: string | MessageContent[];
	status?: string;
	data?: MessageDataPayload | null;
	model?: string;
	log_id?: string;
	citations?: string[];
	app?: string;
	mode?: ChatMode;
	id?: string;
	tool_call_id?: string;
	tool_call_arguments?: string | Record<string, any>;
	timestamp?: number;
	platform?: Platform;
	usage?: Record<string, any>;
}

export type ChatInput = string | { prompt: string };

export interface IBody {
	completion_id: string;
	input: ChatInput;
	attachments?: Attachment[];
	date: string;
	location?: {
		latitude?: number;
		longitude?: number;
	};
	model?: string;
	platform?: Platform;
	mode?: ChatMode;
	verbosity?: VerbosityLevel;
	role?: ChatRole;
	[other: string]: any;
}

export interface IFeedbackBody {
	log_id: string;
	feedback: 1 | -1 | "1" | "-1" | undefined | null;
	score: number;
}

export type RagOptions = {
	topK?: number;
	scoreThreshold?: number;
	includeMetadata?: boolean;
	namespace?: string;
	type?: string;
	chunkSize?: number;
	summaryThreshold?: number;
	returnValues?: boolean;
	returnMetadata?: "none" | "indexed" | "all";
	filter?: Record<string, any>;
};

export interface IRequest {
	app_url?: string;
	env: IEnv;
	request?: IBody;
	user?: IUser;
	mode?: ChatMode;
	use_rag?: boolean;
	rag_options?: RagOptions;
	context?: ServiceContext;
}

interface AIControlParams {
	// Controls the randomness of the output; higher values produce more random results.
	temperature?: number;
	// Controls the maximum number of tokens in the response.
	max_tokens?: number;
	// Controls the minimum number of tokens in the response.
	min_tokens?: number;
	// Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.
	top_p?: number;
	// Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.
	top_k?: number;
	// Random seed for reproducibility of the generation.
	seed?: number;
	// Penalty for repeated tokens; higher values discourage repetition.
	repetition_penalty?: number;
	// Controls the frequency of the AI's responses by controlling how many words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.
	frequency_penalty?: number;
	// Controls the relevance of the AI's responses by controlling how many words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.
	presence_penalty?: number;
	// The number of responses to generate.
	n?: number;
	// Whether to stream the response.
	stream?: boolean;
	// The stop sequences to use for the response.
	stop?: string[];
	// The logit bias to use for the response.
	logit_bias?: Record<string, number>;
	// The metadata to use for the response.
	metadata?: Record<string, any>;
	// The reasoning effort to use for the response (legacy alias).
	reasoning_effort?: ReasoningEffortLevel;
	// Whether to store the response.
	store?: boolean;
	// The current step to use for the response.
	current_step?: number;
	// The maximum number of steps to use for the response.
	max_steps?: number;
	// Whether to use multi-model for the response.
	use_multi_model?: boolean;
}

export interface ChatRequestOptions extends Record<string, any> {
	cache_ttl_seconds?: number;
}

interface AIResponseParamsBase extends AIControlParams {
	// The platform the user requested with.
	platform?: Platform;
	// The URL of the app.
	app_url?: string;
	// The system prompt to use for the response.
	system_prompt?: string;
	// The environment variables to use for the response.
	env: IEnv;
	// The user to use for the response.
	user?: IUser;
	// The version of the API to use for the response.
	version?: string;
	// Whether to disable functions for the response.
	disable_functions?: boolean;
	// The ID of the completion to use for the response.
	completion_id?: string;
	// The messages to use for the response.
	messages?: Message[];
	// The message to use for the response.
	message?: string;
	// The prefix text used for FIM requests.
	prompt?: string;
	// The suffix text used for FIM requests.
	suffix?: string;
	// The model to use for the response.
	model?: string;
	// The mode to use for the response.
	mode?: ChatMode;
	// Desired output verbosity for providers that support the legacy knob.
	verbosity?: VerbosityLevel;
	// Whether to think for the response.
	should_think?: boolean;
	// The response format to use for the response.
	response_format?: Record<string, any>;
	// Whether to enable RAG for the response.
	use_rag?: boolean;
	// Whether the request is a Fill-in-the-Middle generation.
	fim_mode?: boolean;
	// The Mercury edit operation requested.
	edit_operation?: "next" | "apply";
	// The options for RAG for the response.
	rag_options?: RagOptions;
	// The budget constraint to use for the response.
	budget_constraint?: number;
	// The location of the user to use for the response.
	location?: {
		latitude: number;
		longitude: number;
	};
	// The language to use for the response.
	lang?: string;
	// The tools that can be used for the response.
	tools?: Record<string, any>[];
	// The tools that should be enabled for the response.
	enabled_tools?: string[];
	// The tool choice to use for the response.
	tool_choice?:
		| "required"
		| "auto"
		| "none"
		| { type: "function"; name: string };
	// Whether to enable parallel tool calls for the response.
	parallel_tool_calls?: boolean;
	// Additional options for the response.
	options?: ChatRequestOptions;
	// The body of the request.
	body?: Record<string, any>;
	// Whether to enable thinking for the response.
	thinking?: {
		type: "enabled" | "disabled";
		budget_tokens?: number;
	};
	// The ID of the current agent, used for team delegation.
	current_agent_id?: string;
	// The delegation call stack to prevent infinite loops
	delegation_stack?: string[];
	// Maximum delegation depth allowed
	max_delegation_depth?: number;
}

export type ChatCompletionParametersWithModel = RequireAtLeastOne<
	AIResponseParamsBase,
	"model" | "version"
>;

export type ChatCompletionParameters = RequireAtLeastOne<
	AIResponseParamsBase,
	"body" | "messages" | "message"
> &
	RequireAtLeastOne<AIResponseParamsBase, "model" | "version">;

export interface CreateChatCompletionsResponse {
	id: string;
	log_id: string;
	object: string;
	created: number;
	model?: string;
	choices: Array<{
		index: number;
		message: {
			role: ChatRole;
			content: string | MessageContent[];
			data?: Record<string, any>;
			tool_calls?: Record<string, any>[];
			citations?: string[] | null;
			status?: string;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	post_processing?: {
		guardrails?: {
			passed: boolean;
			error?: string;
			violations?: any[];
		};
	};
	usage_limits?: {
		daily?: {
			used: number;
			limit: number;
		};
		pro?: {
			used: number;
			limit: number;
		};
	};
}

export interface AssistantMessageData {
	content: string | MessageContent[];
	thinking?: string;
	signature?: string;
	citations?: any[];
	tool_calls?: any[];
	data?: any;
	usage?: any;
	guardrails?: {
		passed: boolean;
		error?: string;
		violations?: any[];
	};
	log_id?: string | null;
	model?: string;
	selected_models?: string[];
	platform?: Platform;
	timestamp?: number;
	id?: string;
	finish_reason?: string;
	mode?: ChatMode;
	refusal?: string | null;
	annotations?: unknown;
}

export type CoreChatOptions = ChatCompletionParameters & {
	use_multi_model?: boolean;
	anonymousUser?: any;
	current_step?: number;
	max_steps?: number;
};
