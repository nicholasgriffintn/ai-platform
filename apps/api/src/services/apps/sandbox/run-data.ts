import {
	type SandboxRun,
	type SandboxRunData,
	type SandboxRunEvent,
	type SandboxRunStatus,
	sandboxRunDataSchema,
} from "@assistant/schemas";

export { type SandboxRunData, type SandboxRunStatus };

export function parseSandboxRunData(value: unknown): SandboxRunData | null {
	const parsed = sandboxRunDataSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function appendSandboxRunEvent(
	events: SandboxRunEvent[] | undefined,
	event: SandboxRunEvent,
	maxEvents: number,
): SandboxRunEvent[] {
	const next = [...(events ?? []), event];
	if (next.length <= maxEvents) {
		return next;
	}

	return next.slice(next.length - maxEvents);
}

export function toSandboxRunResponse(data: SandboxRunData): SandboxRun {
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
		cancelRequestedAt: data.cancelRequestedAt,
		cancellationReason: data.cancellationReason,
	};
}
