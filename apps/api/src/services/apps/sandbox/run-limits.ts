import type { ServiceContext } from "~/lib/context/serviceContext";
import { SANDBOX_RUNS_APP_ID } from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { parseSandboxRunData, type SandboxRunData } from "./run-data";
import { resolveSandboxExecutionQuotaConfig } from "./config";

const ACTIVE_STATUSES = new Set<string>(["queued", "running", "paused"]);

function parseRunRecord(data: string): SandboxRunData | null {
	return parseSandboxRunData(safeParseJson(data));
}

function toEpochMillis(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

export async function assertSandboxRunCanStart(params: {
	context: ServiceContext;
	userId: number;
	now?: Date;
}): Promise<void> {
	const { context, userId } = params;
	const nowMs = (params.now ?? new Date()).getTime();
	const config = resolveSandboxExecutionQuotaConfig(context.env);

	const records = await context.repositories.appData.getAppDataByUserAndApp(
		userId,
		SANDBOX_RUNS_APP_ID,
	);
	const runs = records
		.map((record) => parseRunRecord(record.data))
		.filter((run): run is SandboxRunData => Boolean(run));

	const activeRunCount = runs.filter((run) =>
		ACTIVE_STATUSES.has(run.status),
	).length;
	if (activeRunCount >= config.maxConcurrentRuns) {
		throw new AssistantError(
			`You have reached the sandbox concurrency limit (${config.maxConcurrentRuns} active runs). Wait for an active run to finish before starting another.`,
			ErrorType.RATE_LIMIT_ERROR,
		);
	}

	const oneMinuteAgoMs = nowMs - 60_000;
	const runStartsInLastMinute = runs.filter((run) => {
		const startedAtMs = toEpochMillis(run.startedAt);
		return startedAtMs !== null && startedAtMs >= oneMinuteAgoMs;
	}).length;
	if (runStartsInLastMinute >= config.maxRunStartsPerMinute) {
		throw new AssistantError(
			`Sandbox run rate limit reached (${config.maxRunStartsPerMinute} starts per minute). Please wait before starting another run.`,
			ErrorType.RATE_LIMIT_ERROR,
		);
	}

	const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
	const runStartsInLastDay = runs.filter((run) => {
		const startedAtMs = toEpochMillis(run.startedAt);
		return startedAtMs !== null && startedAtMs >= oneDayAgoMs;
	}).length;
	if (runStartsInLastDay >= config.maxRunsPerDay) {
		throw new AssistantError(
			`Sandbox daily quota reached (${config.maxRunsPerDay} runs per 24 hours).`,
			ErrorType.RATE_LIMIT_ERROR,
		);
	}
}
