import type { ModelSelectorPanelLayout } from "@ngriffin_uk/polychat-component-models";
import { type RefObject, useLayoutEffect, useState } from "react";

export function useModelSelectorLayout(
  isOpen: boolean,
  triggerWrapperRef: RefObject<HTMLDivElement | null>,
): ModelSelectorPanelLayout | null {
  const [layout, setLayout] = useState<ModelSelectorPanelLayout | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setLayout(null);

      return;
    }

    const updateDialogLayout = () => {
      const wrapper = triggerWrapperRef.current;

      if (!wrapper) {
        return;
      }

      const chatInputShell = wrapper.closest("[data-chat-input-shell]");

      if (!(chatInputShell instanceof HTMLElement)) {
        setLayout(null);

        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const shellRect = chatInputShell.getBoundingClientRect();

      setLayout({
        left: shellRect.left - wrapperRect.left,
        width: shellRect.width,
        maxHeight: Math.max(120, wrapperRect.top - 16),
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

    if (wrapper) {
      observer.observe(wrapper);
    }

    if (chatInputShell instanceof HTMLElement) {
      observer.observe(chatInputShell);
    }

    window.addEventListener("resize", updateDialogLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDialogLayout);
    };
  }, [isOpen, triggerWrapperRef]);

  return layout;
}
