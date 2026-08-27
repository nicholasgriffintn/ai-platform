import type { ArtifactProps } from "@ngriffin_uk/polychat-component-content";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The panel unmounts its artifact only after the close transition, so the data
 * outlives the visibility flag by this much.
 */
const CLOSE_TRANSITION_MS = 300;

interface UseArtifactPanelOptions {
  onOpen?: (artifact: ArtifactProps, combined: boolean) => void;
  onClose?: (artifact: ArtifactProps) => void;
  /** Opt out when the host already owns a keydown handler covering Escape. */
  closeOnEscape?: boolean;
}

export interface ArtifactPanel {
  currentArtifact: ArtifactProps | null;
  currentArtifacts: ArtifactProps[];
  isPanelVisible: boolean;
  isCombinedPanel: boolean;
  openArtifact: (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => void;
  /** Swap the open artifact for a fresher revision without reopening the panel. */
  replaceArtifact: (artifact: ArtifactProps) => void;
  closePanel: () => void;
}

export function useArtifactPanel(options: UseArtifactPanelOptions = {}): ArtifactPanel {
  const { onOpen, onClose, closeOnEscape = false } = options;

  const [currentArtifact, setCurrentArtifact] = useState<ArtifactProps | null>(null);
  const [currentArtifacts, setCurrentArtifacts] = useState<ArtifactProps[]>([]);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isCombinedPanel, setIsCombinedPanel] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingClear = useCallback(() => {
    if (clearTimer.current === null) {
      return;
    }

    clearTimeout(clearTimer.current);
    clearTimer.current = null;
  }, []);

  const openArtifact = useCallback(
    (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => {
      // A reopen inside the close window would otherwise be wiped by the pending clear.
      cancelPendingClear();

      const combined = Boolean(combine && artifacts && artifacts.length > 1);

      setCurrentArtifact(artifact);
      setIsPanelVisible(true);
      setCurrentArtifacts(combined && artifacts ? artifacts : []);
      setIsCombinedPanel(combined);

      onOpen?.(artifact, combined);
    },
    [cancelPendingClear, onOpen],
  );

  const replaceArtifact = useCallback((artifact: ArtifactProps) => {
    setCurrentArtifact(artifact);
  }, []);

  const closePanel = useCallback(() => {
    if (currentArtifact) {
      onClose?.(currentArtifact);
    }

    setIsPanelVisible(false);
    setIsCombinedPanel(false);

    cancelPendingClear();
    clearTimer.current = setTimeout(() => {
      clearTimer.current = null;
      setCurrentArtifact(null);
      setCurrentArtifacts([]);
    }, CLOSE_TRANSITION_MS);
  }, [cancelPendingClear, currentArtifact, onClose]);

  useEffect(() => cancelPendingClear, [cancelPendingClear]);

  useEffect(() => {
    if (!closeOnEscape || !isPanelVisible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, closePanel, isPanelVisible]);

  return {
    currentArtifact,
    currentArtifacts,
    isPanelVisible,
    isCombinedPanel,
    openArtifact,
    replaceArtifact,
    closePanel,
  };
}
