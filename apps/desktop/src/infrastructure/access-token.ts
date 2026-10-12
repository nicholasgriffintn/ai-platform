import type { DesktopSessionToken } from "@ngriffin_uk/polychat-schemas";

import { expiresAtMs, isTokenStale } from "./session-refresh";

export interface DesktopAccessToken {
  current: () => Promise<string | null>;
  renew: () => Promise<void>;
  forget: () => void;
}

export function createDesktopAccessToken(
  issue: () => Promise<DesktopSessionToken>,
  now: () => number = Date.now,
): DesktopAccessToken {
  let token: string | null = null;
  let expiresAt = 0;
  let generation = 0;
  let pending: Promise<void> | null = null;

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

  const current = async () => {
    if (token === null || !isTokenStale(expiresAt, now())) {
      return token;
    }

    try {
      await renew();
    } catch {
      return expiresAt > now() ? token : null;
    }

    return token;
  };

  const forget = () => {
    generation += 1;
    pending = null;
    token = null;
    expiresAt = 0;
  };

  return { current, renew, forget };
}
