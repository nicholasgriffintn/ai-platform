import type { DesktopSessionToken } from "@ngriffin_uk/polychat-schemas";

import { expiresAtMs, isTokenStale } from "./session-refresh";

export interface DesktopAccessToken {
  current: () => Promise<string | null>;
  renew: () => Promise<void>;
  forget: () => void;
  onSignedOut: (listener: () => void) => () => void;
}

export interface DesktopAccessTokenSource {
  issue: () => Promise<DesktopSessionToken>;
  isSignedIn: () => Promise<boolean>;
  now?: () => number;
}

export function createDesktopAccessToken({
  issue,
  isSignedIn,
  now = Date.now,
}: DesktopAccessTokenSource): DesktopAccessToken {
  let token: string | null = null;
  let expiresAt = 0;
  let generation = 0;
  let pending: Promise<void> | null = null;
  const signedOutListeners = new Set<() => void>();

  const adopt = async (issuedFor: number) => {
    const session = await issue();

    if (issuedFor === generation) {
      token = session.token;
      expiresAt = expiresAtMs(session.expiresIn, now());
    }
  };

  const renew = () => {
    pending ??= adopt(generation).finally(() => {
      pending = null;
    });

    return pending;
  };

  const forget = () => {
    generation += 1;
    pending = null;
    token = null;
    expiresAt = 0;
  };

  const current = async () => {
    if (token === null || !isTokenStale(expiresAt, now())) {
      return token;
    }

    const renewingFor = generation;

    try {
      await renew();
    } catch (cause) {
      if (renewingFor !== generation) {
        return token;
      }

      if (!(await isSignedIn().catch(() => true))) {
        forget();
        signedOutListeners.forEach((listener) => listener());

        return null;
      }

      if (expiresAt > now()) {
        return token;
      }

      throw cause;
    }

    return token;
  };

  const onSignedOut = (listener: () => void) => {
    signedOutListeners.add(listener);

    return () => {
      signedOutListeners.delete(listener);
    };
  };

  return { current, renew, forget, onSignedOut };
}
