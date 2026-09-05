export type ScrollAlignment = "start" | "center" | "nearest";

export function scrollIntoContainerView(
  container: HTMLElement,
  element: HTMLElement,
  alignment: ScrollAlignment = "nearest",
) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offsetTop = elementRect.top - containerRect.top + container.scrollTop;

  if (alignment === "center") {
    container.scrollTop = offsetTop - (container.clientHeight - elementRect.height) / 2;

    return;
  }

  if (alignment === "start" || offsetTop < container.scrollTop) {
    container.scrollTop = offsetTop;

    return;
  }

  const offsetBottom = offsetTop + elementRect.height;

  if (offsetBottom > container.scrollTop + container.clientHeight) {
    container.scrollTop = offsetBottom - container.clientHeight;
  }
}

export function containsEventTarget(
  element: HTMLElement | null | undefined,
  target: EventTarget | null,
) {
  return Boolean(element && target instanceof Node && element.contains(target));
}
