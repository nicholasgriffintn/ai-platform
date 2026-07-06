interface MetricTokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

export interface MetricMetadata {
	provider: string;
	model: string;
	tokenUsage: MetricTokenUsage;
	cost: number;
	cached: boolean;
	raw: Record<string, unknown> | string;
}

const emptyTokenUsage: MetricTokenUsage = {
	prompt_tokens: 0,
	completion_tokens: 0,
	total_tokens: 0,
};

export function parseMetricMetadata(metadata: string): MetricMetadata {
	const parsed = parseJsonObject(metadata);

	if (!parsed) {
		return {
			provider: "unknown",
			model: "unknown model",
			tokenUsage: emptyTokenUsage,
			cost: 0,
			cached: false,
			raw: metadata,
		};
	}

	return {
		provider: readString(parsed.provider, "unknown"),
		model: readString(parsed.model, "unknown model"),
		tokenUsage: readTokenUsage(parsed.tokenUsage),
		cost: readNumber(parsed.cost, 0),
		cached: readBoolean(parsed.cached),
		raw: parsed,
	};
}

function parseJsonObject(value: string): Record<string, unknown> | null {
	if (!value) return null;

	try {
		const parsed: unknown = JSON.parse(value);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function readTokenUsage(value: unknown): MetricTokenUsage {
	if (!isRecord(value)) return emptyTokenUsage;

	return {
		prompt_tokens: readNumber(value.prompt_tokens, 0),
		completion_tokens: readNumber(value.completion_tokens, 0),
		total_tokens: readNumber(value.total_tokens, 0),
	};
}

function readString(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value.toLowerCase() === "true";
	return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
