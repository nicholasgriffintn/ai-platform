export function hasOwn(objectValue, key) {
	return Object.prototype.hasOwnProperty.call(objectValue, key);
}

export function readNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function scoreHigherIsBetter(value, thresholds) {
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

export function scoreLowerIsBetter(value, thresholds) {
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

export function averageDefined(values) {
	const defined = values.filter((value) => value !== undefined);
	if (defined.length === 0) {
		return undefined;
	}
	return defined.reduce((total, value) => total + value, 0) / defined.length;
}

export function clampRouterScore(value) {
	if (value === undefined) {
		return undefined;
	}
	return Math.min(5, Math.max(1, Math.round(value)));
}
