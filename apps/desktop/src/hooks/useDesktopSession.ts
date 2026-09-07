import { apiKeyService, authService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { getApiOriginMismatch } from "../lib/api-origin";
import { tauriDesktopBackend } from "../lib/desktop-backend";
import { expiresAtMs, isTokenStale, refreshDelayMs } from "../lib/session-refresh";
import { getDesktopSignInMessage } from "../lib/sign-in-message";

const RENEWAL_EVENTS = ["focus", "online"] as const;
const RETRY_AFTER_FAILURE_SECONDS = 0;

export function useDesktopSession() {
  const [isChecking, setChecking] = useState(true);
  const [isSigningIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenExpiresAt = useRef(0);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const setAuthenticatedUserConfiguration = useChatStore(
    (state) => state.setAuthenticatedUserConfiguration,
  );
  const clearAuthenticatedUserConfiguration = useChatStore(
    (state) => state.clearAuthenticatedUserConfiguration,
  );

  const forgetSession = useCallback(() => {
    tokenExpiresAt.current = 0;
    apiKeyService.removeApiKey();
    clearAuthenticatedUserConfiguration();
  }, [clearAuthenticatedUserConfiguration]);

  const adoptToken = useCallback(async () => {
    const session = await tauriDesktopBackend.accessToken();

    await apiKeyService.setApiKey(session.token);
    tokenExpiresAt.current = expiresAtMs(session.expiresIn, Date.now());

    return session.expiresIn;
  }, []);

  const load = useCallback(async () => {
    try {
      const diagnostics = await tauriDesktopBackend.collectDiagnostics();
      const mismatch = getApiOriginMismatch(diagnostics.apiBaseUrl);

      if (mismatch) {
        setError(mismatch);
        forgetSession();

        return;
      }

      if (!(await tauriDesktopBackend.isSignedIn())) {
        forgetSession();

        return;
      }

      await adoptToken();
      await authService.checkAuthStatus();

      setAuthenticatedUserConfiguration({
        hasApiKey: true,
        user: authService.getUser(),
        userSettings: authService.getUserSettings(),
      });
    } catch (cause) {
      setError(getDesktopSignInMessage(cause));
      forgetSession();
    } finally {
      setChecking(false);
    }
  }, [adoptToken, forgetSession, setAuthenticatedUserConfiguration]);

  useEffect(() => {
    void load();
  }, [load]);

  const renew = useCallback(async (): Promise<number | null> => {
    try {
      if (!(await tauriDesktopBackend.isSignedIn())) {
        forgetSession();

        return null;
      }

      return await adoptToken();
    } catch {
      return null;
    }
  }, [adoptToken, forgetSession]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = (expiresInSeconds: number) => {
      timer = setTimeout(() => void cycle(), refreshDelayMs(expiresInSeconds));
    };

    const cycle = async () => {
      const expiresIn = await renew();

      if (!stopped) {
        arm(expiresIn ?? RETRY_AFTER_FAILURE_SECONDS);
      }
    };

    const renewIfStale = () => {
      if (!isTokenStale(tokenExpiresAt.current, Date.now())) {
        return;
      }

      clearTimeout(timer);
      void cycle();
    };

    if (isAuthenticated) {
      arm((tokenExpiresAt.current - Date.now()) / 1000);

      for (const event of RENEWAL_EVENTS) {
        window.addEventListener(event, renewIfStale);
      }
    }

    return () => {
      stopped = true;
      clearTimeout(timer);

      for (const event of RENEWAL_EVENTS) {
        window.removeEventListener(event, renewIfStale);
      }
    };
  }, [isAuthenticated, renew]);

  const signOut = useCallback(async () => {
    setError(null);

    await Promise.allSettled([authService.logout(), tauriDesktopBackend.signOut()]);

    forgetSession();
  }, [forgetSession]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);

    try {
      await tauriDesktopBackend.signIn();
      await load();
    } catch (cause) {
      setError(getDesktopSignInMessage(cause));
    } finally {
      setSigningIn(false);
    }
  }, [load]);

  return { isChecking, isSigningIn, error, signIn, signOut };
}
