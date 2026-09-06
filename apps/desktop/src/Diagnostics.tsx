import { useCallback, useState } from "react";

import type { ConnectedDesktopBackend, DesktopDiagnostics } from "./desktop-backend";

export function Diagnostics({ backend }: { backend: ConnectedDesktopBackend }) {
  const [report, setReport] = useState<DesktopDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collect = useCallback(async () => {
    setError(null);

    try {
      setReport(await backend.collectDiagnostics());
    } catch (cause) {
      setError(String(cause));
    }
  }, [backend]);

  return (
    <section>
      <h2>Diagnostics</h2>
      <button type="button" onClick={() => void collect()}>
        Collect
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {report ? (
        <dl>
          <dt>Version</dt>
          <dd>{report.appVersion}</dd>
          <dt>Platform</dt>
          <dd>{report.target}</dd>
          <dt>API</dt>
          <dd>{report.apiBaseUrl}</dd>
          <dt>Database</dt>
          <dd>{report.databasePath}</dd>
          <dt>Runtimes configured</dt>
          <dd>{report.endpointCount}</dd>
          <dt>Keychain</dt>
          <dd>{report.keychainAvailable ? "Reachable" : "Unavailable"}</dd>
          <dt>Signed in</dt>
          <dd>{report.signedIn ? "Yes" : "No"}</dd>
          <dt>Collected</dt>
          <dd>{report.collectedAt}</dd>
        </dl>
      ) : null}
    </section>
  );
}
