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

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  downloadBlob(filename, new Blob([content], { type: `${mimeType};charset=utf-8` }));
}

export function runWhenIdle(callback: () => void, timeoutMs = 8000): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(() => callback(), { timeout: timeoutMs });

    return () => window.cancelIdleCallback(handle);
  }

  const handle = setTimeout(callback, 3000);

  return () => clearTimeout(handle);
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
