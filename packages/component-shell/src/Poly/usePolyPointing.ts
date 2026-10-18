import { findPolyAnchor, usePetStore } from "@ngriffin_uk/polychat-library-react";
import { polyPlaceAnchor, type PolyNavigationTarget } from "@ngriffin_uk/polychat-schemas";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";
import { useCallback } from "react";

const POINT_MS = 700;
const HIGHLIGHT_MS = 1600;
const POINTED_CLASS = "polychat-poly-pointed";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function usePolyPointing(): (target: PolyNavigationTarget) => Promise<void> {
  const lookAt = usePetStore((state) => state.lookAt);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  return useCallback(
    (target) => {
      if (target.kind !== "place") {
        return Promise.resolve();
      }

      const anchor = polyPlaceAnchor(target.place);
      const element = findPolyAnchor(anchor);

      if (!element) {
        return Promise.resolve();
      }

      lookAt(anchor, HIGHLIGHT_MS);
      element.classList.add(POINTED_CLASS);
      window.setTimeout(() => element.classList.remove(POINTED_CLASS), HIGHLIGHT_MS);

      return prefersReducedMotion
        ? Promise.resolve()
        : new Promise((resolve) => window.setTimeout(resolve, POINT_MS));
    },
    [lookAt, prefersReducedMotion],
  );
}
