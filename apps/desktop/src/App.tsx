import type { DesktopEndpoint, DesktopRuntimeReadiness } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useState } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

const READINESS_LABELS: Record<DesktopRuntimeReadiness["status"], string> = {
  ready: "Ready",
  unreachable: "Not running",
  unauthorised: "Needs authorisation",
  unrecognised: "Unrecognised version",
};

function readinessLabel(readiness: DesktopRuntimeReadiness | undefined): string {
  if (!readiness) {
    return "Not checked";
  }

  if (readiness.status === "ready" && readiness.version) {
    return `Ready, version ${readiness.version}`;
  }

  return READINESS_LABELS[readiness.status];
}

export function App({ backend }: { backend: ConnectedDesktopBackend }) {
  const [endpoints, setEndpoints] = useState<DesktopEndpoint[]>([]);
  const [readiness, setReadiness] = useState<Record<string, DesktopRuntimeReadiness>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend
      .listEndpoints()
      .then(setEndpoints)
      .catch((cause: unknown) => setError(String(cause)));
  }, [backend]);

  const probe = useCallback(
    async (endpointId: string) => {
      try {
        const result = await backend.probeEndpoint(endpointId);

        setReadiness((current) => ({ ...current, [endpointId]: result }));
      } catch (cause) {
        setError(String(cause));
      }
    },
    [backend],
  );

  return (
    <main>
      <h1>Runtimes on this device</h1>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {endpoints.map((endpoint) => (
          <li key={endpoint.id}>
            <span>{endpoint.label}</span>
            <span>{endpoint.kind === "model" ? "Model runtime" : "Agent runtime"}</span>
            <span>{endpoint.url}</span>
            <span>{readinessLabel(readiness[endpoint.id])}</span>
            <button type="button" onClick={() => void probe(endpoint.id)}>
              Check
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
