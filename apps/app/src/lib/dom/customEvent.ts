export function readCustomEventDetail(event: Event): unknown {
	return event instanceof CustomEvent ? event.detail : undefined;
}
