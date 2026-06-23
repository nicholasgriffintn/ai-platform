import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHoverPreviewDismiss } from "./useHoverPreviewDismiss";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("useHoverPreviewDismiss", () => {
	it("schedules hover preview dismissal after a short delay", () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		const { result } = renderHook(() => useHoverPreviewDismiss(onDismiss));

		act(() => result.current.scheduleDismiss());
		act(() => vi.advanceTimersByTime(179));

		expect(onDismiss).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(1));

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("keeps the hover preview open when scheduled dismissal is cancelled", () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		const { result } = renderHook(() => useHoverPreviewDismiss(onDismiss));

		act(() => result.current.scheduleDismiss());
		act(() => result.current.cancelDismiss());
		act(() => vi.runAllTimers());

		expect(onDismiss).not.toHaveBeenCalled();
	});

	it("keeps the hover preview open when scrolling inside the preview", () => {
		const onDismiss = vi.fn();
		const preview = document.createElement("div");
		const previewContent = document.createElement("div");
		preview.appendChild(previewContent);
		document.body.appendChild(preview);
		const previewRef: RefObject<HTMLElement | null> = { current: preview };

		renderHook(() => useHoverPreviewDismiss(onDismiss, previewRef));

		act(() => previewContent.dispatchEvent(new Event("scroll", { bubbles: true })));

		expect(onDismiss).not.toHaveBeenCalled();
		preview.remove();
	});

	it("dismisses the hover preview when scrolling outside the preview", () => {
		const onDismiss = vi.fn();
		const preview = document.createElement("div");
		const outside = document.createElement("div");
		document.body.appendChild(preview);
		document.body.appendChild(outside);
		const previewRef: RefObject<HTMLElement | null> = { current: preview };

		renderHook(() => useHoverPreviewDismiss(onDismiss, previewRef));

		act(() => outside.dispatchEvent(new Event("scroll", { bubbles: true })));

		expect(onDismiss).toHaveBeenCalledTimes(1);
		preview.remove();
		outside.remove();
	});
});
