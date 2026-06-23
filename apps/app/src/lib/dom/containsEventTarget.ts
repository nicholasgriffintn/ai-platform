export function containsEventTarget(
	element: HTMLElement | null | undefined,
	target: EventTarget | null,
) {
	return Boolean(element && target instanceof Node && element.contains(target));
}
