import {
  getStatePath,
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
  const boundPathsRef = useRef<string[]>([]);

  useEffect(() => {
    const bindings = boundState ?? {};
    const previousPaths = boundPathsRef.current;

    boundPathsRef.current = Object.keys(bindings);

    if (previousPaths.length === 0 && boundPathsRef.current.length === 0) {
      return;
    }

    setState((previous) => {
      let next = previous;

      for (const path of previousPaths) {
        if (!Object.hasOwn(bindings, path)) {
          next = setStatePath(next, path, getStatePath(page.state, path));
        }
      }

      for (const [path, value] of Object.entries(bindings)) {
        next = setStatePath(next, path, value);
      }

      stateRef.current = next;

      return next;
    });
  }, [boundState, page.state]);

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
