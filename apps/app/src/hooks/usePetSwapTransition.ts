import { useEffect, useRef, useState } from "react";

export const PET_SWAP_FADE_MS = 160;

export interface PetSwapTransition<T> {
  displayed: T;
  visible: boolean;
}

export function usePetSwapTransition<T>(
  value: T,
  identity: string,
  ready: boolean,
  transitionEnabled: boolean,
): PetSwapTransition<T> {
  const [displayed, setDisplayed] = useState(value);
  const [visible, setVisible] = useState(ready);
  const valueRef = useRef(value);
  const displayedIdentityRef = useRef(identity);
  const displayedReadyRef = useRef(ready);

  valueRef.current = value;

  useEffect(() => {
    if (!ready || !displayedReadyRef.current || !transitionEnabled) {
      displayedIdentityRef.current = identity;
      displayedReadyRef.current = ready;
      setDisplayed(valueRef.current);
      setVisible(ready);

      return undefined;
    }

    if (displayedIdentityRef.current === identity) {
      setVisible(true);

      return undefined;
    }

    setVisible(false);

    let frame = 0;
    const timeout = window.setTimeout(() => {
      displayedIdentityRef.current = identity;
      displayedReadyRef.current = ready;
      setDisplayed(valueRef.current);
      frame = window.requestAnimationFrame(() => setVisible(true));
    }, PET_SWAP_FADE_MS);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
  }, [identity, ready, transitionEnabled]);

  return { displayed, visible };
}
