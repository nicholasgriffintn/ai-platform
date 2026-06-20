export { isSupportedCronExpression } from "@assistant/schemas";

function floorToUtcMinute(date: Date): Date {
	const minute = new Date(date);
	minute.setUTCSeconds(0, 0);
	return minute;
}

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

function matchesCronBase(base: string, value: number, step: number | null): boolean {
	if (base === "*") {
		return step === null ? true : value % step === 0;
	}

	if (base.includes("-")) {
		const rangeParts = base.split("-");
		if (rangeParts.length !== 2) {
			return false;
		}

		const startValue = parseNonNegativeInteger(rangeParts[0]);
		const endValue = parseNonNegativeInteger(rangeParts[1]);
		if (startValue === null || endValue === null || startValue > endValue) {
			return false;
		}

		return (
			value >= startValue &&
			value <= endValue &&
			(step === null || (value - startValue) % step === 0)
		);
	}

	const parsed = parseNonNegativeInteger(base);
	return parsed !== null && step === null && value === parsed;
}

function parseCronPart(part: string, value: number, options?: { sundayAlias?: boolean }): boolean {
	const values = options?.sundayAlias === true && value === 0 ? [0, 7] : [value];

	return part.split(",").some((token) => {
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
		if (stepValue !== undefined && step === null) {
			return false;
		}

		return values.some((candidate) => matchesCronBase(base, candidate, step));
	});
}

export function doesCronMatchDate(cronExpression: string, date: Date): boolean {
	const parts = cronExpression.trim().split(/\s+/);
	if (parts.length !== 5) {
		return false;
	}

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
	return (
		parseCronPart(minute, date.getUTCMinutes()) &&
		parseCronPart(hour, date.getUTCHours()) &&
		parseCronPart(dayOfMonth, date.getUTCDate()) &&
		parseCronPart(month, date.getUTCMonth() + 1) &&
		parseCronPart(dayOfWeek, date.getUTCDay(), { sundayAlias: true })
	);
}

export function getCronMatchingDatesInRange(params: {
	cronExpression: string;
	start: Date;
	end: Date;
	includeStart?: boolean;
}): Date[] {
	const end = floorToUtcMinute(params.end);
	const firstTime = floorToUtcMinute(params.start).getTime();
	const dates: Date[] = [];

	for (let time = firstTime; time <= end.getTime(); time += 60 * 1000) {
		if (
			time < params.start.getTime() ||
			(params.includeStart === false && time === params.start.getTime())
		) {
			continue;
		}

		const date = new Date(time);
		if (doesCronMatchDate(params.cronExpression, date)) {
			dates.push(date);
		}
	}

	return dates;
}
