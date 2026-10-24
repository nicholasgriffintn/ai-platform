import type { DesktopSessionToken } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createDesktopAccessToken } from "./access-token";

const FIFTEEN_MINUTES = 15 * 60;

const signedIn = async () => true;

function issuer(...tokens: string[]) {
  let issued = 0;

  return vi.fn(async (): Promise<DesktopSessionToken> => {
    const token = tokens[Math.min(issued, tokens.length - 1)] ?? "token";

    issued += 1;

    return { token, expiresIn: FIFTEEN_MINUTES };
  });
}

describe("desktop access token", () => {
  it("stays anonymous until the session has been adopted", async () => {
    const issue = issuer("first");
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn });

    expect(await accessToken.current()).toBeNull();
    expect(issue).not.toHaveBeenCalled();
  });

  it("renews a stale token before handing it to a request, so waking never sends an expired one", async () => {
    let now = 0;
    const issue = issuer("first", "second");
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn, now: () => now });

    await accessToken.renew();
    now += 14 * 60 * 1000;

    expect(await accessToken.current()).toBe("second");
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it("asks the host once when many requests find the token stale together", async () => {
    let now = 0;
    const issue = issuer("first", "second");
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn, now: () => now });

    await accessToken.renew();
    now += 14 * 60 * 1000;

    const tokens = await Promise.all([
      accessToken.current(),
      accessToken.current(),
      accessToken.current(),
    ]);

    expect(tokens).toEqual(["second", "second", "second"]);
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it("keeps a token that has not yet expired when renewal fails, and fails the request once it has", async () => {
    let now = 0;
    const issue = vi
      .fn<() => Promise<DesktopSessionToken>>()
      .mockResolvedValueOnce({ token: "first", expiresIn: FIFTEEN_MINUTES })
      .mockRejectedValue(new Error("offline"));
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn, now: () => now });
    const signedOut = vi.fn();

    accessToken.onSignedOut(signedOut);
    await accessToken.renew();
    now += 14 * 60 * 1000;

    expect(await accessToken.current()).toBe("first");

    now += 2 * 60 * 1000;

    await expect(accessToken.current()).rejects.toThrow("offline");
    expect(signedOut).not.toHaveBeenCalled();
  });

  it("recovers once the host is reachable again after waking offline", async () => {
    let now = 0;
    const issue = vi
      .fn<() => Promise<DesktopSessionToken>>()
      .mockResolvedValueOnce({ token: "first", expiresIn: FIFTEEN_MINUTES })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ token: "second", expiresIn: FIFTEEN_MINUTES });
    const accessToken = createDesktopAccessToken({ issue, isSignedIn: signedIn, now: () => now });

    await accessToken.renew();
    now += 60 * 60 * 1000;

    await expect(accessToken.current()).rejects.toThrow("offline");
    expect(await accessToken.current()).toBe("second");
  });

  it("signs out only when the host no longer holds a session", async () => {
    let now = 0;
    const issue = vi
      .fn<() => Promise<DesktopSessionToken>>()
      .mockResolvedValueOnce({ token: "first", expiresIn: FIFTEEN_MINUTES })
      .mockRejectedValue(new Error("Sign-in could not be completed (status 401)."));
    const accessToken = createDesktopAccessToken({
      issue,
      isSignedIn: async () => false,
      now: () => now,
    });
    const signedOut = vi.fn();

    accessToken.onSignedOut(signedOut);
    await accessToken.renew();
    now += 14 * 60 * 1000;

    expect(await accessToken.current()).toBeNull();
    expect(signedOut).toHaveBeenCalledTimes(1);
    expect(await accessToken.current()).toBeNull();
  });

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
