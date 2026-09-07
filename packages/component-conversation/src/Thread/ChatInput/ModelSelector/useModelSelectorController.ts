import {
  getHoverPreviewPosition,
  type ModelHoverPreviewState,
  useHoverPreviewDismiss,
} from "@ngriffin_uk/polychat-component-models";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { containsEventTarget } from "@ngriffin_uk/polychat-utility-react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { useModelSelectorLayout } from "./useModelSelectorLayout.js";

interface UseModelSelectorControllerOptions {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export type ModelSelectorController = ReturnType<typeof useModelSelectorController>;

export function useModelSelectorController({
  isOpen,
  onOpen,
  onClose,
}: UseModelSelectorControllerOptions) {
  const { isMobile } = useUIStore();
  const [hoverPreview, setHoverPreview] = useState<ModelHoverPreviewState | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hoverPreviewRef = useRef<HTMLDivElement | null>(null);
  const panelLayout = useModelSelectorLayout(isOpen, triggerWrapperRef);

  const clearHoverPreview = useCallback(() => setHoverPreview(null), []);
  const {
    cancelDismiss: cancelHoverPreviewDismiss,
    dismiss: dismissHoverPreview,
    scheduleDismiss: scheduleHoverPreviewDismiss,
  } = useHoverPreviewDismiss(clearHoverPreview, hoverPreviewRef);

  const dismissSelector = useCallback(() => {
    onClose();
  }, [onClose]);
  const closeSelector = useCallback(() => {
    onClose();
    triggerRef.current?.focus({ preventScroll: true });
  }, [onClose]);
  const toggleSelector = useCallback(() => {
    if (isOpen) {
      dismissSelector();
    } else {
      onOpen();
    }
  }, [dismissSelector, isOpen, onOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isInsideSelector =
        containsEventTarget(dropdownRef.current, event.target) ||
        containsEventTarget(triggerWrapperRef.current, event.target) ||
        containsEventTarget(hoverPreviewRef.current, event.target);

      if (!isInsideSelector) {
        dismissSelector();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dismissSelector]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    dismissHoverPreview();
  }, [dismissHoverPreview, isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        closeSelector();

        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      const items = dropdownRef.current?.querySelectorAll(
        '[data-model-option]:not([aria-disabled="true"])',
      );

      if (!items?.length) {
        return;
      }

      const list = Array.from(items) as HTMLElement[];
      const active = document.activeElement as HTMLElement;
      const index = list.indexOf(active);
      const next =
        event.key === "ArrowDown"
          ? index < list.length - 1
            ? index + 1
            : 0
          : index > 0
            ? index - 1
            : list.length - 1;

      list[next].focus();
    },
    [closeSelector],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isMobile && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });

      return;
    }

    const firstOption = dropdownRef.current?.querySelector("[data-model-option]");

    (firstOption as HTMLElement | null)?.focus({ preventScroll: true });
  }, [isMobile, isOpen]);

  const handleInfoHoverStart = useCallback(
    (modelInfo: ModelConfigItem, anchorRect: DOMRect) => {
      cancelHoverPreviewDismiss();

      if (!isOpen) {
        dismissHoverPreview();

        return;
      }

      const position = getHoverPreviewPosition(
        anchorRect,
        dropdownRef.current?.getBoundingClientRect(),
      );

      if (!position) {
        dismissHoverPreview();

        return;
      }

      setHoverPreview({ model: modelInfo, ...position });
    },
    [cancelHoverPreviewDismiss, dismissHoverPreview, isOpen],
  );

  return {
    dropdownRef,
    triggerRef,
    triggerWrapperRef,
    searchInputRef,
    hoverPreviewRef,
    panelLayout,
    hoverPreview,
    toggleSelector,
    closeSelector,
    dismissSelector,
    handleKeyDown,
    handleInfoHoverStart,
    handleInfoHoverEnd: scheduleHoverPreviewDismiss,
    cancelHoverPreviewDismiss,
  };
}
