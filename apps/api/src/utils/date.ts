export function formatUtcDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}
