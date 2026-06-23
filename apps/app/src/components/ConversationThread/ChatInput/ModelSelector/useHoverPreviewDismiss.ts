import { type RefObject, useCallback, useEffect, useRef } from "react";

import { containsEventTarget } from "~/lib/dom/containsEventTarget";

const HOVER_PREVIEW_DISMISS_DELAY_MS = 180;

function isScrollWithinIgnoredElement(
	event: Event,
	ignoredElement: HTMLElement | null | undefined,
) {
	return containsEventTarget(ignoredElement, event.target);
}

export function useHoverPreviewDismiss(
	onDismiss: () => void,
	scrollIgnoreRef?: RefObject<HTMLElement | null>,
) {
	const timeoutRef = useRef<number | null>(null);

	const cancelDismiss = useCallback(() => {
		if (timeoutRef.current === null) return;
		window.clearTimeout(timeoutRef.current);
		timeoutRef.current = null;
	}, []);

	const dismiss = useCallback(() => {
		cancelDismiss();
		onDismiss();
	}, [cancelDismiss, onDismiss]);

	const scheduleDismiss = useCallback(() => {
		cancelDismiss();
		timeoutRef.current = window.setTimeout(() => {
			timeoutRef.current = null;
			onDismiss();
		}, HOVER_PREVIEW_DISMISS_DELAY_MS);
	}, [cancelDismiss, onDismiss]);

	useEffect(() => {
		return () => cancelDismiss();
	}, [cancelDismiss]);

	useEffect(() => {
		const handleScroll = (event: Event) => {
			if (isScrollWithinIgnoredElement(event, scrollIgnoreRef?.current)) return;
			dismiss();
		};

		window.addEventListener("resize", dismiss);
		window.addEventListener("scroll", handleScroll, true);
		return () => {
			window.removeEventListener("resize", dismiss);
			window.removeEventListener("scroll", handleScroll, true);
		};
	}, [dismiss, scrollIgnoreRef]);

	return {
		cancelDismiss,
		dismiss,
		scheduleDismiss,
	};
}
