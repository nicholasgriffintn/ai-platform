export function formatTokenCount(value?: number) {
	if (!value) return null;
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
	return String(value);
}

export function formatTokenPrice(value?: number) {
	if (typeof value !== "number") return null;
	if (value === 0) return "$0 / 1K tokens";
	if (value < 0.01) return `$${value.toFixed(4)} / 1K tokens`;
	return `$${value.toFixed(2)} / 1K tokens`;
}
