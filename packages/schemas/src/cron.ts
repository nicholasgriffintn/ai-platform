function parsePositiveInteger(value: string): number | null {
	if (!/^\d+$/.test(value)) {
		return null;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(value: string): number | null {
	if (!/^\d+$/.test(value)) {
		return null;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function isInRange(value: number, min: number, max: number): boolean {
	return value >= min && value <= max;
}

function isSupportedCronBase(base: string, min: number, max: number): boolean {
	if (base === "*") {
		return true;
	}

	if (base.includes("-")) {
		const rangeParts = base.split("-");
		if (rangeParts.length !== 2) {
			return false;
		}

		const startValue = parseNonNegativeInteger(rangeParts[0]);
		const endValue = parseNonNegativeInteger(rangeParts[1]);
		return (
			startValue !== null &&
			endValue !== null &&
			startValue <= endValue &&
			isInRange(startValue, min, max) &&
			isInRange(endValue, min, max)
		);
	}

	const parsed = parseNonNegativeInteger(base);
	return parsed !== null && isInRange(parsed, min, max);
}

function isSupportedCronPart(part: string, min: number, max: number): boolean {
	return part.split(",").every((token) => {
		const trimmed = token.trim();
		if (!trimmed) {
			return false;
		}

		const slashParts = trimmed.split("/");
		if (slashParts.length > 2) {
			return false;
		}

		const [base, stepValue] = slashParts;
		const step = stepValue === undefined ? null : parsePositiveInteger(stepValue);
		return (
			(stepValue === undefined || step !== null) &&
			typeof base === "string" &&
			isSupportedCronBase(base, min, max)
		);
	});
}

export function isSupportedCronExpression(cronExpression: string): boolean {
	const parts = cronExpression.trim().split(/\s+/);
	if (parts.length !== 5) {
		return false;
	}

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
	return (
		isSupportedCronPart(minute, 0, 59) &&
		isSupportedCronPart(hour, 0, 23) &&
		isSupportedCronPart(dayOfMonth, 1, 31) &&
		isSupportedCronPart(month, 1, 12) &&
		isSupportedCronPart(dayOfWeek, 0, 7)
	);
}
