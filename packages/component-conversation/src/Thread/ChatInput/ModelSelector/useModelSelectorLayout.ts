import type { ModelSelectorPanelLayout } from "@ngriffin_uk/polychat-component-models";
import { useLayoutEffect, useState } from "react";

export function useModelSelectorLayout(
  isOpen: boolean,
  wrapper: HTMLDivElement | null,
): ModelSelectorPanelLayout | null {
  const [layout, setLayout] = useState<ModelSelectorPanelLayout | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setLayout(null);

      return undefined;
    }

    const shell = wrapper?.closest<HTMLElement>("[data-chat-input-shell]");

    if (!wrapper || !shell) {
      return undefined;
    }

    const updateLayout = () => {
      const shellRect = shell.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const scale = shell.offsetHeight > 0 ? shellRect.height / shell.offsetHeight : 1;

      setLayout({
        container: shell,
        bottom: (shellRect.bottom - wrapperRect.top) / (scale || 1),
        maxHeight: Math.max(120, (wrapperRect.top - 16) / (scale || 1)),
      });
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);

    observer.observe(shell);
    observer.observe(wrapper);
    window.addEventListener("resize", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [isOpen, wrapper]);

  return layout;
}
