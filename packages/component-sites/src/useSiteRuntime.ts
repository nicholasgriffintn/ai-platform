import {
  runSiteAction,
  setStatePath,
  type SiteScope,
  type SiteState,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteActionBinding, SiteDataAction, SitePage } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SiteRenderRuntime {
  state: SiteState;
  setPath: (path: string, value: unknown) => void;
  dispatch: (binding: SiteActionBinding, scope: SiteScope) => Promise<boolean>;
}

export function useSiteRuntime(
  page: SitePage,
  boundState: Record<string, unknown> | undefined,
  onDataAction: ((action: SiteDataAction) => Promise<unknown>) | undefined,
  navigate?: (path: string) => void,
) {
  const [state, setState] = useState<SiteState>(() => ({ ...page.state }));
  const stateRef = useRef(state);
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = useRef(false);

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

  const runtime = useMemo<SiteRenderRuntime>(
    () => ({
      state,
      setPath: (path, value) => {
        const next = setStatePath(stateRef.current, path, value);

        stateRef.current = next;
        setState(next);
      },
      dispatch: async (binding, scope) => {
        const result = runSiteAction(binding, { ...scope, state: stateRef.current });

        if (result.error) {
          setActionError(result.error);

          return false;
        }

        stateRef.current = result.state;
        setState(result.state);
        if (result.navigate) {
          navigate?.(result.navigate);
        }

        if (!result.effect) {
          return true;
        }

        if (pending.current) {
          return false;
        }

        pending.current = true;
        setActionError(null);

        try {
          if (!onDataAction) {
            throw new Error("Open this app in Sites to use saved data");
          }

          await onDataAction(result.effect);

          return true;
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "The action failed");

          return false;
        } finally {
          pending.current = false;
        }
      },
    }),
    [state, navigate, onDataAction],
  );

  return { runtime, actionError };
}
