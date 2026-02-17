import type { IEnv } from "~/types";
import {
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
} from "@assistant/schemas";

const DEFAULT_MAX_CONCURRENT_RUNS = 2;
const DEFAULT_MAX_RUNS_PER_DAY = 25;
const DEFAULT_MAX_RUN_STARTS_PER_MINUTE = 4;

function parsePositiveInteger(input: string | undefined): number | null {
	if (!input) {
		return null;
	}

	const parsed = Number.parseInt(input, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

export interface SandboxTimeoutConfig {
	timeoutSeconds: number;
	timeoutMs: number;
	timeoutAt: string;
}

export interface SandboxExecutionQuotaConfig {
	maxConcurrentRuns: number;
	maxRunsPerDay: number;
	maxRunStartsPerMinute: number;
}

export function resolveSandboxTimeoutSeconds(
	env: IEnv,
	requestedTimeoutSeconds?: number,
): number {
	const configuredDefault =
		parsePositiveInteger(env.SANDBOX_DEFAULT_TIMEOUT_SECONDS) ??
		SANDBOX_TIMEOUT_DEFAULT_SECONDS;
	const configuredMax =
		parsePositiveInteger(env.SANDBOX_MAX_TIMEOUT_SECONDS) ??
		SANDBOX_TIMEOUT_MAX_SECONDS;

	const maxTimeoutSeconds = Math.max(
		SANDBOX_TIMEOUT_MIN_SECONDS,
		configuredMax,
	);
	const requested = requestedTimeoutSeconds ?? configuredDefault;

	return Math.max(
		SANDBOX_TIMEOUT_MIN_SECONDS,
		Math.min(requested, maxTimeoutSeconds),
	);
}

export function buildSandboxTimeoutConfig(params: {
	env: IEnv;
	requestedTimeoutSeconds?: number;
	now?: Date;
}): SandboxTimeoutConfig {
	const { env, requestedTimeoutSeconds } = params;
	const now = params.now ?? new Date();
	const timeoutSeconds = resolveSandboxTimeoutSeconds(
		env,
		requestedTimeoutSeconds,
	);
	const timeoutMs = timeoutSeconds * 1000;
	const timeoutAt = new Date(now.getTime() + timeoutMs).toISOString();

	return {
		timeoutSeconds,
		timeoutMs,
		timeoutAt,
	};
}

export function resolveSandboxExecutionQuotaConfig(
	env: IEnv,
): SandboxExecutionQuotaConfig {
	const maxConcurrentRuns =
		parsePositiveInteger(env.SANDBOX_MAX_CONCURRENT_RUNS) ??
		DEFAULT_MAX_CONCURRENT_RUNS;
	const maxRunsPerDay =
		parsePositiveInteger(env.SANDBOX_MAX_RUNS_PER_DAY) ??
		DEFAULT_MAX_RUNS_PER_DAY;
	const maxRunStartsPerMinute =
		parsePositiveInteger(env.SANDBOX_MAX_RUN_STARTS_PER_MINUTE) ??
		DEFAULT_MAX_RUN_STARTS_PER_MINUTE;

	return {
		maxConcurrentRuns: Math.max(1, maxConcurrentRuns),
		maxRunsPerDay: Math.max(1, maxRunsPerDay),
		maxRunStartsPerMinute: Math.max(1, maxRunStartsPerMinute),
	};
}
