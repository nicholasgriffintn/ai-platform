import type { DesktopSessionToken } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createDesktopAccessToken } from "./access-token";

const FIFTEEN_MINUTES = 15 * 60;

const signedIn = async () => true;

describe("desktop access token", () => {
  it("does not let a renewal that finishes after sign-out restore the old session", async () => {
    let release: ((session: DesktopSessionToken) => void) | undefined;
    const issue = vi.fn(
      () =>
        new Promise<DesktopSessionToken>((resolve) => {
          release = resolve;
        }),
    );
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn });
    const renewal = accessToken.renew();

    accessToken.forget();
    release?.({ token: "revoked", expiresIn: FIFTEEN_MINUTES });
    await renewal;

    expect(await accessToken.current()).toBeNull();
  });
});
