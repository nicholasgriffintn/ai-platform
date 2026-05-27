import { joinNonEmptyStrings } from "../strings/joinNonEmptyStrings";

export function formatRealtimeWebSocketCloseError(label: string, event: CloseEvent): string {
	const detail = joinNonEmptyStrings(
		[event.code ? `code ${event.code}` : undefined, event.reason],
		", ",
	);

	return detail ? `${label} disconnected (${detail})` : `${label} disconnected`;
}
