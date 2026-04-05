import {
	type DynamicWorkerRun,
	type DynamicWorkerRunData,
	type DynamicWorkerRunEvent,
	dynamicWorkerRunDataSchema,
} from "@assistant/schemas";

export { type DynamicWorkerRunData };

export function parseDynamicWorkerRunData(
	value: unknown,
): DynamicWorkerRunData | null {
	const parsed = dynamicWorkerRunDataSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function appendDynamicWorkerRunEvent(
	events: DynamicWorkerRunEvent[] | undefined,
	event: DynamicWorkerRunEvent,
	maxEvents: number,
): DynamicWorkerRunEvent[] {
	const next = [...(events ?? []), event];
	if (next.length <= maxEvents) {
		return next;
	}

	return next.slice(next.length - maxEvents);
}

export function toDynamicWorkerRunResponse(
	data: DynamicWorkerRunData,
): DynamicWorkerRun {
	return {
		...data,
		events: data.events ?? [],
	};
}
