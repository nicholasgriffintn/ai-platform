import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useState } from "react";

export function useMediaVolume(
  attach: (element: HTMLMediaElement | null) => void,
  volume: number,
): (element: HTMLMediaElement | null) => void {
  const [element, setElement] = useState<HTMLMediaElement | null>(null);

  useEffect(() => {
    if (element) {
      element.volume = clampNumber(volume, 0, 1);
    }
  }, [element, volume]);

  return useCallback(
    (next: HTMLMediaElement | null) => {
      setElement(next);
      attach(next);
    },
    [attach],
  );
}
