export type SandboxRunStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface SandboxRunData {
	runId: string;
	installationId: number;
	repo: string;
	task: string;
	model: string;
	shouldCommit: boolean;
	status: SandboxRunStatus;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	error?: string;
	events?: Array<Record<string, unknown>>;
	result?: Record<string, unknown>;
}

const SANDBOX_RUN_STATUSES = new Set<SandboxRunStatus>([
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalRecordArray(
	value: unknown,
): Array<Record<string, unknown>> | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const records = value.filter((entry): entry is Record<string, unknown> =>
		isObjectRecord(entry),
	);
	return records.length > 0 ? records : [];
}

function toOptionalRecord(value: unknown): Record<string, unknown> | undefined {
	return isObjectRecord(value) ? value : undefined;
}

export function parseSandboxRunData(value: unknown): SandboxRunData | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const runId = value.runId;
	const installationId = value.installationId;
	const repo = value.repo;
	const task = value.task;
	const model = value.model;
	const shouldCommit = value.shouldCommit;
	const status = value.status;
	const startedAt = value.startedAt;
	const updatedAt = value.updatedAt;

	if (typeof runId !== "string" || !runId.trim()) {
		return null;
	}
	if (typeof installationId !== "number" || !Number.isFinite(installationId)) {
		return null;
	}
	if (typeof repo !== "string" || !repo.trim()) {
		return null;
	}
	if (typeof task !== "string" || !task.trim()) {
		return null;
	}
	if (typeof model !== "string" || !model.trim()) {
		return null;
	}
	if (typeof shouldCommit !== "boolean") {
		return null;
	}
	if (
		typeof status !== "string" ||
		!SANDBOX_RUN_STATUSES.has(status as SandboxRunStatus)
	) {
		return null;
	}
	if (typeof startedAt !== "string" || !startedAt.trim()) {
		return null;
	}
	if (typeof updatedAt !== "string" || !updatedAt.trim()) {
		return null;
	}

	const completedAt =
		typeof value.completedAt === "string" ? value.completedAt : undefined;
	const error = typeof value.error === "string" ? value.error : undefined;
	const events = toOptionalRecordArray(value.events);
	const result = toOptionalRecord(value.result);

	return {
		runId,
		installationId,
		repo,
		task,
		model,
		shouldCommit,
		status: status as SandboxRunStatus,
		startedAt,
		updatedAt,
		completedAt,
		error,
		events,
		result,
	};
}

export function toSandboxRunResponse(data: SandboxRunData) {
	return {
		runId: data.runId,
		installationId: data.installationId,
		repo: data.repo,
		task: data.task,
		model: data.model,
		shouldCommit: data.shouldCommit,
		status: data.status,
		startedAt: data.startedAt,
		updatedAt: data.updatedAt,
		completedAt: data.completedAt,
		error: data.error,
		result: data.result,
		events: data.events ?? [],
	};
}
