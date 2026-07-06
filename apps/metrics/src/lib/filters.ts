export interface MetricsParams {
	status: string;
	limit: number;
	interval: number;
	timeframe: number;
}

export interface RawMetricsParams {
	status: FormDataEntryValue | string | null;
	limit: FormDataEntryValue | string | null;
	interval: FormDataEntryValue | string | null;
	timeframe: FormDataEntryValue | string | null;
}

const allowedStatuses = new Set(["success", "error"]);

const numericBounds = {
	limit: { min: 1, max: 1000 },
	interval: { min: 1, max: 1440 },
	timeframe: { min: 1, max: 168 },
} as const;

export function normaliseMetricsFilters(
	rawFilters: RawMetricsParams,
	fallbackFilters: MetricsParams,
): MetricsParams {
	return {
		status: normaliseStatus(rawFilters.status, fallbackFilters.status),
		limit: normaliseNumber(rawFilters.limit, fallbackFilters.limit, numericBounds.limit),
		interval: normaliseNumber(
			rawFilters.interval,
			fallbackFilters.interval,
			numericBounds.interval,
		),
		timeframe: normaliseNumber(
			rawFilters.timeframe,
			fallbackFilters.timeframe,
			numericBounds.timeframe,
		),
	};
}

function normaliseStatus(value: FormDataEntryValue | string | null, fallback: string): string {
	const status = typeof value === "string" ? value : fallback;
	return allowedStatuses.has(status) ? status : fallback;
}

function normaliseNumber(
	value: FormDataEntryValue | string | null,
	fallback: number,
	bounds: { min: number; max: number },
): number {
	if (typeof value !== "string" || value.trim() === "") {
		return fallback;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(bounds.max, Math.max(bounds.min, Math.trunc(parsed)));
}
