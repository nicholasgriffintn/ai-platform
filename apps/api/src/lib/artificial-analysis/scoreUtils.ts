export function scoreHigherIsBetter(
	value: number | undefined,
	thresholds: readonly number[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value >= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}

export function scoreLowerIsBetter(
	value: number | undefined,
	thresholds: readonly number[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value <= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}
