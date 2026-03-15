import type { ServiceContext } from "~/lib/context/serviceContext";
import { SANDBOX_RUNS_APP_ID } from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { parseSandboxRunData } from "./run-data";
import { resolveSandboxExecutionQuotaConfig } from "./config";

const ACTIVE_STATUSES = new Set(["queued", "running", "paused"]);

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

	const oneMinuteAgoMs = nowMs - 60_000;
	const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
	let activeRunCount = 0;
	let runStartsInLastMinute = 0;
	let runStartsInLastDay = 0;

	for (const record of records) {
		const createdAtMs = toEpochMillis(record.created_at);
		const recordData = parseSandboxRunData(safeParseJson(record.data));

		if (recordData && ACTIVE_STATUSES.has(recordData.status)) {
			activeRunCount += 1;
			if (activeRunCount >= config.maxConcurrentRuns) {
				throw new AssistantError(
					`You have reached the sandbox concurrency limit (${config.maxConcurrentRuns} active runs). Wait for an active run to finish before starting another.`,
					ErrorType.RATE_LIMIT_ERROR,
				);
			}
		}

		const startedAtMs =
			createdAtMs !== null ? createdAtMs : toEpochMillis(recordData?.startedAt);
		if (startedAtMs === null) {
			continue;
		}

		if (startedAtMs >= oneDayAgoMs) {
			runStartsInLastDay += 1;
			if (runStartsInLastDay >= config.maxRunsPerDay) {
				throw new AssistantError(
					`Sandbox daily quota reached (${config.maxRunsPerDay} runs per 24 hours).`,
					ErrorType.RATE_LIMIT_ERROR,
				);
			}

			if (startedAtMs >= oneMinuteAgoMs) {
				runStartsInLastMinute += 1;
				if (runStartsInLastMinute >= config.maxRunStartsPerMinute) {
					throw new AssistantError(
						`Sandbox run rate limit reached (${config.maxRunStartsPerMinute} starts per minute). Please wait before starting another run.`,
						ErrorType.RATE_LIMIT_ERROR,
					);
				}
			}
		}
	}
}
