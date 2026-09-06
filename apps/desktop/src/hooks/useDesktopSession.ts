import { authService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCallback, useEffect, useState } from "react";

import { tauriDesktopBackend } from "../lib/desktop-backend";
import { getDesktopSignInMessage } from "../lib/sign-in-message";

export function useDesktopSession() {
  const [isChecking, setChecking] = useState(true);
  const [isSigningIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthenticatedUserConfiguration = useChatStore(
    (state) => state.setAuthenticatedUserConfiguration,
  );
  const clearAuthenticatedUserConfiguration = useChatStore(
    (state) => state.clearAuthenticatedUserConfiguration,
  );

  const load = useCallback(async () => {
    try {
      if (!(await tauriDesktopBackend.isSignedIn())) {
        clearAuthenticatedUserConfiguration();

        return;
      }

      await authService.checkAuthStatus();

      setAuthenticatedUserConfiguration({
        hasApiKey: true,
        user: authService.getUser(),
        userSettings: authService.getUserSettings(),
      });
    } catch (cause) {
      setError(getDesktopSignInMessage(cause));
      clearAuthenticatedUserConfiguration();
    } finally {
      setChecking(false);
    }
  }, [clearAuthenticatedUserConfiguration, setAuthenticatedUserConfiguration]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return { isChecking, isSigningIn, error, signIn };
}
