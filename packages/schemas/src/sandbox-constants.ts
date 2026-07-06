export const SANDBOX_PROMPT_STRATEGIES = [
	"auto",
	"feature-delivery",
	"bug-fix",
	"refactor",
	"test-hardening",
] as const;

export const SANDBOX_TASK_TYPES = [
	"feature-implementation",
	"code-review",
	"test-suite",
	"bug-fix",
	"refactoring",
	"documentation",
	"migration",
] as const;

export const SANDBOX_TIMEOUT_MIN_SECONDS = 30;
export const SANDBOX_TIMEOUT_DEFAULT_SECONDS = 900;
export const SANDBOX_TIMEOUT_MAX_SECONDS = 7200;
export const SANDBOX_TRUST_LEVELS = ["strict", "balanced", "trusted"] as const;

export type SandboxPromptStrategy = (typeof SANDBOX_PROMPT_STRATEGIES)[number];
export type SandboxTaskType = (typeof SANDBOX_TASK_TYPES)[number];
export type SandboxTrustLevel = (typeof SANDBOX_TRUST_LEVELS)[number];

export interface SandboxModelSettings {
	temperature?: number;
	top_p?: number;
	top_k?: number;
	max_tokens?: number;
	presence_penalty?: number;
	frequency_penalty?: number;
	reasoning_effort?:
		| "none"
		| "simulated-thinking"
		| "thinking"
		| "low"
		| "medium"
		| "high"
		| "xhigh";
	reasoning?: {
		effort?: "none" | "simulated-thinking" | "thinking" | "low" | "medium" | "high" | "xhigh";
	};
	verbosity?: "low" | "medium" | "high" | "caveman";
}
