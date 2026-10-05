import {
  runSiteAction,
  setStatePath,
  type SiteScope,
  type SiteState,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteActionBinding, SitePage } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SiteRenderRuntime {
  state: SiteState;
  setPath: (path: string, value: unknown) => void;
  dispatch: (binding: SiteActionBinding, scope: SiteScope) => void;
}

export function useSiteRuntime(
  page: SitePage,
  boundState: Record<string, unknown> | undefined,
  navigate?: (path: string) => void,
) {
  const [state, setState] = useState<SiteState>(() => ({ ...page.state }));
  const stateRef = useRef(state);

  useEffect(() => {
    if (boundState) {
      setState((previous) => {
        let next = previous;

        for (const [path, value] of Object.entries(boundState)) {
          next = setStatePath(next, path, value);
        }

        stateRef.current = next;

        return next;
      });
    }
  }, [boundState]);

  return useMemo<SiteRenderRuntime>(
    () => ({
      state,
      setPath: (path, value) => {
        const next = setStatePath(stateRef.current, path, value);

        stateRef.current = next;
        setState(next);
      },
      dispatch: (binding, scope) => {
        const result = runSiteAction(binding, { ...scope, state: stateRef.current });

        stateRef.current = result.state;
        setState(result.state);
        if (result.navigate) {
          navigate?.(result.navigate);
        }
      },
    }),
    [state, navigate],
  );
}
