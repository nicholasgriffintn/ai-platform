import type { ModelSelectorPanelLayout } from "@ngriffin_uk/polychat-component-models";
import { type RefObject, useEffect, useState } from "react";

const MAX_PANEL_WIDTH = 660;

/**
 * Web hosts anchor the model panel to the chat input shell so it can span the composer rather than
 * the trigger. Other surfaces can supply their own layout without changing the render package.
 */
export function useModelSelectorLayout(
	isOpen: boolean,
	triggerWrapperRef: RefObject<HTMLDivElement | null>,
): ModelSelectorPanelLayout | null {
	const [layout, setLayout] = useState<ModelSelectorPanelLayout | null>(null);

	useEffect(() => {
		if (!isOpen) {
			setLayout(null);
			return;
		}

		const updateDialogLayout = () => {
			const wrapper = triggerWrapperRef.current;
			if (!wrapper) return;

			const chatInputShell = wrapper.closest("[data-chat-input-shell]");
			if (!(chatInputShell instanceof HTMLElement)) {
				setLayout(null);
				return;
			}

			const shellRect = chatInputShell.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();

			setLayout({
				left: shellRect.left - wrapperRect.left,
				width: Math.min(MAX_PANEL_WIDTH, shellRect.width),
			});
		};

		updateDialogLayout();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateDialogLayout);
			return () => window.removeEventListener("resize", updateDialogLayout);
		}

		const observer = new ResizeObserver(updateDialogLayout);
		const wrapper = triggerWrapperRef.current;
		const chatInputShell = wrapper?.closest("[data-chat-input-shell]");
		if (wrapper) observer.observe(wrapper);
		if (chatInputShell instanceof HTMLElement) observer.observe(chatInputShell);
		window.addEventListener("resize", updateDialogLayout);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateDialogLayout);
		};
	}, [isOpen, triggerWrapperRef]);

	return layout;
}
