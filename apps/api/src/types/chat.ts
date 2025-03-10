import type { IEnv, RequireAtLeastOne } from "./shared";
import type { IUser } from "./user";

export type Platform = "web" | "mobile" | "api";

export type ContentType = "text" | "image_url" | "audio_url" | "thinking";
export type ChatRole = "user" | "assistant" | "tool" | "developer";
export type ChatMode =
	| "normal"
	| "local"
	| "remote"
	| "prompt_coach"
	| "no_system";

export type ResponseMode = "normal" | "concise" | "explanatory" | "formal";

export type MessageContent = {
	type: ContentType;
	text?: string;
	image_url?: {
		url: string;
	};
	audio_url?: {
		url: string;
	};
	thinking?: string;
	signature?: string;
};

export type Attachment = {
	type: "image";
	url: string;
	detail?: "low" | "high";
};

export interface Message {
	role: ChatRole;
	name?: string;
	tool_calls?: Record<string, any>[];
	parts?: {
		text: string;
	}[];
	content: string | MessageContent[];
	status?: string;
	data?: Record<string, any>;
	model?: string;
	logId?: string;
	citations?: string[];
	app?: string;
	mode?: ChatMode;
	id?: string;
	timestamp?: number;
	platform?: Platform;
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
	response_mode?: ResponseMode;
	role?: ChatRole;
	[other: string]: any;
}

export interface IFeedbackBody {
	logId: string;
	feedback: 1 | -1 | "1" | "-1" | undefined | null;
	score: number;
}

export type RagOptions = {
	topK?: number;
	scoreThreshold?: number;
	includeMetadata?: boolean;
	namespace?: string;
	type?: string;
};

export interface IRequest {
	app_url?: string;
	env: IEnv;
	request?: IBody;
	user?: IUser;
	webhook_url?: string;
	webhook_events?: string[];
	mode?: ChatMode;
	use_rag?: boolean;
	rag_options?: RagOptions;
}

interface AIControlParams {
	// Controls the randomness of the output; higher values produce more random results.
	temperature?: number;
	// Controls the maximum number of tokens in the response.
	max_tokens?: number;
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
	// The reasoning effort to use for the response.
	reasoning_effort?: "low" | "medium" | "high";
	// Whether to store the response.
	store?: boolean;
}

interface AIResponseParamsBase extends AIControlParams {
	// The platform the user requested with.
	platform?: Platform;
	// The URL of the app, used with webhooks.
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
	// The URL of the webhook from the request.
	webhook_url?: string;
	// The events to use for the webhook.
	webhook_events?: string[];
	// The ID of the completion to use for the response.
	completion_id?: string;
	// The messages to use for the response.
	messages: Message[];
	// The message to use for the response.
	message?: string;
	// The model to use for the response.
	model?: string;
	// The mode to use for the response.
	mode?: ChatMode;
	// Whether to think for the response.
	should_think?: boolean;
	// Whether to enable RAG for the response.
	use_rag?: boolean;
	// The options for RAG for the response.
	rag_options?: RagOptions;
	// How the system prompt should be formed.
	response_mode?: ResponseMode;
	// The budget constraint to use for the response.
	budget_constraint?: number;
	// The location of the user to use for the response.
	location?: {
		latitude: number;
		longitude: number;
	};
}

export type ChatCompletionParameters = RequireAtLeastOne<
	AIResponseParamsBase,
	"model" | "version"
>;
