import type { ExecutionContext } from "@cloudflare/workers-types";
import type {
	ChatCompletionRequestBody as SchemaChatCompletionRequestBody,
	ChatCompletionResponseBody as SchemaChatCompletionResponseBody,
	ChatRequestOptions as SchemaChatRequestOptions,
	MessagePart as SchemaMessagePart,
} from "@assistant/schemas";
import type { ServiceContext } from "../lib/context/serviceContext";
import type { AnonymousUser } from "./anonymous-user";
import type { IEnv, ReasoningEffortLevel, VerbosityLevel } from "./shared";
import type { IUser } from "./user";

export type Platform = "web" | "mobile" | "api" | "obsidian" | "dynamic-apps";

export type ContentType =
	| "text"
	| "image_url"
	| "audio_url"
	| "video_url"
	| "input_audio"
	| "thinking"
	| "document_url"
	| "markdown_document"
	| "artifact_selection"
	| "file"
	| "tool_result";
export type ChatRole = "user" | "assistant" | "tool" | "developer" | "system";
export type ChatMode =
	| "normal"
	| "local"
	| "remote"
	| "no_system"
	| "agent"
	| "plan"
	| "build"
	| "explore"
	| "thinking";
export type MessagePart = SchemaMessagePart;

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
	artifact_selection?: {
		artifact: {
			identifier: string;
			type: string;
			title?: string;
		};
		selectedText: string;
		selectionStart: number;
		selectionEnd: number;
	};
	thinking?: string;
	signature?: string;
	image?: number[] | string;
	tool_use_id?: string;
	id?: string;
	name?: string;
	content?: string;
	input?: string | Record<string, unknown>;
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
	parts?: MessagePart[];
	content: string | MessageContent[] | Record<string, unknown>;
	status?: string;
	data?: MessageDataPayload | null;
	model?: string;
	log_id?: string;
	citations?: string[];
	app?: string;
	mode?: ChatMode;
	id?: string;
	parent_message_id?: string;
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
	provider?: string;
	platform?: Platform;
	mode?: ChatMode;
	approved_tools?: string[];
	tool_permissions_map?: Record<string, string[]>;
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
	top_k?: number;
	score_threshold?: number;
	include_metadata?: boolean;
	topK?: number;
	scoreThreshold?: number;
	includeMetadata?: boolean;
	namespace?: string;
	type?: string;
	contentType?: string;
	embeddingType?: string;
	userId?: number | string;
	chunkSize?: number;
	summaryThreshold?: number;
	returnValues?: boolean;
	returnMetadata?: "none" | "indexed" | "all";
	filter?: Record<string, any>;
	rerankCandidates?: number;
};

export interface IRequest {
	app_url?: string;
	env: IEnv;
	request?: IBody;
	user?: IUser;
	anonymousUser?: AnonymousUser;
	mode?: ChatMode;
	use_rag?: boolean;
	rag_options?: RagOptions;
	context?: ServiceContext;
}

type InternalExecutionParams = {
	// Minimum output tokens requested by internal orchestration.
	min_tokens?: number;
	// Current orchestration step for streamed multi-step responses.
	current_step?: number;
	// The URL of the app.
	app_url?: string;
	// The environment variables to use for the response.
	env: IEnv;
	// Runtime service context for authenticated user, repositories, and request cache.
	context?: ServiceContext;
	// The Worker execution context for background analytics delivery.
	executionCtx?: ExecutionContext;
	// Whether analytics tracking is permitted for this request.
	analyticsTrackingEnabled?: boolean | null;
	// The version of the API to use for the response.
	version?: string;
	// Whether to disable functions for the response.
	disable_functions?: boolean;
	// Runtime-normalised messages.
	messages?: Message[];
	// Provider-formatted tools.
	tools?: Record<string, any>[];
	// Provider thinking configuration after request preparation.
	thinking?: {
		type: "enabled" | "disabled";
		budget_tokens?: number;
	};
	// The message to use for the response.
	message?: string;
	// The prefix text used for FIM requests.
	prompt?: string;
	// The suffix text used for FIM requests.
	suffix?: string;
	// Whether the request is a Fill-in-the-Middle generation.
	fim_mode?: boolean;
	// The Mercury edit operation requested.
	edit_operation?: "next" | "apply";
	// The location of the user to use for the response.
	location?: {
		latitude: number;
		longitude: number;
	};
	// The language to use for the response.
	lang?: string;
	// The body of the request.
	body?: Record<string, any>;
	// The ID of the current agent, used for team delegation.
	current_agent_id?: string;
	// The delegation call stack to prevent infinite loops
	delegation_stack?: string[];
	// Maximum delegation depth allowed
	max_delegation_depth?: number;
};

export type ChatRequestOptions = SchemaChatRequestOptions;

type RuntimeChatRequestFields = "messages" | "tools" | "user";

export type ChatCompletionParametersWithModel = Omit<
	SchemaChatCompletionRequestBody,
	RuntimeChatRequestFields
> &
	InternalExecutionParams;

export type ChatCompletionParameters = Omit<
	SchemaChatCompletionRequestBody,
	RuntimeChatRequestFields
> &
	InternalExecutionParams;

export type CreateChatCompletionsResponse = SchemaChatCompletionResponseBody;

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
	anonymousUser?: any;
	context?: ServiceContext;
};
