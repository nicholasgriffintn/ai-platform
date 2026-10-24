import { authService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCallback, useEffect, useState } from "react";

import { getApiOriginMismatch } from "../infrastructure/api-origin";
import { tauriDesktopBackend } from "../infrastructure/desktop-backend";
import { desktopAccessToken } from "../infrastructure/desktop-session-token";
import { removeMachineAdvertisement } from "../infrastructure/machine-heartbeat";
import { getDesktopSignInMessage } from "../infrastructure/sign-in-message";

const UNCONFIRMED_ACCOUNT =
  "Polychat could not confirm your account. Check your connection and sign in again.";
const SESSION_ENDED = "Your session ended. Sign in again to carry on.";

export function useDesktopSession() {
  const [isChecking, setChecking] = useState(true);
  const [isSigningIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const setAuthenticatedUserConfiguration = useChatStore(
    (state) => state.setAuthenticatedUserConfiguration,
  );
  const clearAuthenticatedUserConfiguration = useChatStore(
    (state) => state.clearAuthenticatedUserConfiguration,
  );

  const forgetSession = useCallback(() => {
    desktopAccessToken.forget();
    clearAuthenticatedUserConfiguration();
  }, [clearAuthenticatedUserConfiguration]);

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

      await desktopAccessToken.renew();

      if (!(await authService.checkAuthStatus())) {
        setError(UNCONFIRMED_ACCOUNT);
        forgetSession();

        return;
      }

      setAuthenticatedUserConfiguration({
        hasApiKey: true,
        user: authService.getUser(),
        userSettings: authService.getUserSettings(),
      });
      setError(null);
    } catch (cause) {
      setError(getDesktopSignInMessage(cause));
      forgetSession();
    } finally {
      setChecking(false);
    }
  }, [forgetSession, setAuthenticatedUserConfiguration]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- initial session load syncs with Tauri backend (external system); state settles on async completion
    void load();
  }, [load]);

  useEffect(
    () =>
      desktopAccessToken.onSignedOut(() => {
        clearAuthenticatedUserConfiguration();
        setError(SESSION_ENDED);
      }),
    [clearAuthenticatedUserConfiguration],
  );

  useEffect(() => {
    if (isChecking || isAuthenticated) {
      return undefined;
    }

    const retry = () => void load();

    window.addEventListener("online", retry);

    return () => window.removeEventListener("online", retry);
  }, [isAuthenticated, isChecking, load]);

  const signOut = useCallback(async () => {
    setError(null);

    await removeMachineAdvertisement().catch(() => undefined);
    await Promise.allSettled([authService.logout(), tauriDesktopBackend.signOut()]);

    forgetSession();
  }, [forgetSession]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);

    try {
      if (!(await tauriDesktopBackend.isSignedIn())) {
        await tauriDesktopBackend.signIn();
      }

      await load();
    } catch (cause) {
      setError(getDesktopSignInMessage(cause));
    } finally {
      setSigningIn(false);
    }
  }, [load]);

  return { isChecking, isSigningIn, error, signIn, signOut };
}
