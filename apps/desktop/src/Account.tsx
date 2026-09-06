import { useCallback, useEffect, useState } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

export function Account({ backend }: { backend: ConnectedDesktopBackend }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSignedIn(await backend.isSignedIn());
    } catch (cause) {
      setError(String(cause));
    }
  }, [backend]);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const current = await backend.isSignedIn();

        if (active) {
          setSignedIn(current);
        }
      } catch (cause) {
        if (active) {
          setError(String(cause));
        }
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [backend]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);

      try {
        await action();
        await refresh();
      } catch (cause) {
        setError(String(cause));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <section>
      <h2>Account</h2>
      <p>
        {signedIn === null
          ? "Checking"
          : signedIn
            ? "Signed in. Cloud models are available."
            : "Not signed in. Models on this device still work."}
      </p>
      {signedIn ? (
        <button type="button" disabled={busy} onClick={() => void run(backend.signOut)}>
          Sign out
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run(backend.signIn)}>
          Sign in with GitHub
        </button>
      )}
      {busy && signedIn === false ? <p>Finish signing in in your browser.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
