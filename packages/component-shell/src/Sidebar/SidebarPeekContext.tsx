import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import {
  createContext,
  type PointerEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Grace period so the pointer can travel from the toggle into the panel. */
export const SIDEBAR_PEEK_CLOSE_DELAY_MS = 200;

export interface SidebarPeekTriggerProps {
  onPointerEnter: PointerEventHandler<HTMLElement>;
  onPointerLeave: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
}

export type SidebarPeekPanelProps = Pick<
  SidebarPeekTriggerProps,
  "onPointerEnter" | "onPointerLeave" | "onPointerCancel"
>;

interface SidebarPeekController {
  peeking: boolean;
  hold: () => void;
  release: () => void;
  cancel: () => void;
}

const noop = () => {};

const SidebarPeekContext = createContext<SidebarPeekController>({
  peeking: false,
  hold: noop,
  release: noop,
  cancel: noop,
});

/**
 * Shares one hover preview between a sidebar toggle and the sidebar surface, so
 * the pointer can travel from the toggle into the panel without the preview
 * closing underneath it.
 */
export function SidebarPeekProvider({ children }: { children: ReactNode }) {
  const [peeking, setPeeking] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const hold = useCallback(() => {
    clearCloseTimer();
    setPeeking(true);
  }, [clearCloseTimer]);

  const release = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setPeeking(false);
    }, SIDEBAR_PEEK_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const cancel = useCallback(() => {
    clearCloseTimer();
    setPeeking(false);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const controller = useMemo(
    () => ({ peeking, hold, release, cancel }),
    [cancel, hold, peeking, release],
  );

  return <SidebarPeekContext.Provider value={controller}>{children}</SidebarPeekContext.Provider>;
}

/** Binds a "show sidebar" control to the shared hover preview. */
export function useSidebarPeekTrigger(): SidebarPeekTriggerProps {
  const { hold, release, cancel } = useContext(SidebarPeekContext);
  const { isMobile, sidebarVisible } = useUIStore();

  const onPointerEnter = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (event.pointerType === "touch" || isMobile || sidebarVisible) {
        return;
      }

      hold();
    },
    [hold, isMobile, sidebarVisible],
  );

  return {
    onPointerEnter,
    onPointerLeave: release,
    onPointerCancel: release,
    onPointerDown: cancel,
  };
}

/** Binds the sidebar surface to the shared hover preview. */
export function useSidebarPeekPanel(): {
  peeking: boolean;
  panelProps: SidebarPeekPanelProps;
} {
  const { peeking, hold, release } = useContext(SidebarPeekContext);

  return {
    peeking,
    panelProps: {
      onPointerEnter: hold,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  };
}
