export function formatRealtimeWebSocketCloseError(label: string, event: CloseEvent): string {
	const detail = [event.code ? `code ${event.code}` : undefined, event.reason]
		.filter((value): value is string => Boolean(value))
		.join(", ");

	return detail ? `${label} disconnected (${detail})` : `${label} disconnected`;
}
