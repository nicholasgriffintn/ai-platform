const POLLING_DELAYS_SECONDS = [5, 10, 20, 30, 30] as const;

export function getNextPollingSchedule(previousAttempt?: number): {
	pollAttempt: number;
	delaySeconds: number;
	scheduledAt: string;
} {
	const nextAttempt = (previousAttempt ?? 0) + 1;
	const delayIndex = Math.min(
		nextAttempt - 1,
		POLLING_DELAYS_SECONDS.length - 1,
	);
	const delaySeconds = POLLING_DELAYS_SECONDS[delayIndex];
	return {
		pollAttempt: nextAttempt,
		delaySeconds,
		scheduledAt: new Date(Date.now() + delaySeconds * 1000).toISOString(),
	};
}
