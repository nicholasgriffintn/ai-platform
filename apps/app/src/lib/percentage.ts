export function clampPercentage(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(100, Math.max(0, value));
}

export function getBoundedPercentage(value: number, total: number): number {
	if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
		return 0;
	}

	return clampPercentage((value / total) * 100);
}
