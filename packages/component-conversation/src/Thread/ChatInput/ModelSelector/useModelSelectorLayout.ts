import type { ModelSelectorPanelLayout } from "@ngriffin_uk/polychat-component-models";
import { useLayoutEffect, useMemo, useState } from "react";

type PanelMetrics = Pick<ModelSelectorPanelLayout, "bottom" | "maxHeight">;

export function useModelSelectorLayout(
  isOpen: boolean,
  wrapper: HTMLDivElement | null,
): ModelSelectorPanelLayout | null {
  const [metrics, setMetrics] = useState<PanelMetrics | null>(null);
  const shell = useMemo(
    () => wrapper?.closest<HTMLElement>("[data-chat-input-shell]") ?? null,
    [wrapper],
  );

  useLayoutEffect(() => {
    if (!isOpen) {
      setMetrics(null);

      return undefined;
    }

    if (!wrapper || !shell) {
      return undefined;
    }

    const updateLayout = () => {
      const shellRect = shell.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const scale = shell.offsetHeight > 0 ? shellRect.height / shell.offsetHeight : 1;

      setMetrics({
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
  }, [isOpen, shell, wrapper]);

  return useMemo(
    () => (isOpen && shell ? { container: shell, bottom: 0, ...metrics } : null),
    [isOpen, metrics, shell],
  );
}
