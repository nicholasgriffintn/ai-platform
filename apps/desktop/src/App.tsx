import type {
  DesktopEndpoint,
  DesktopRuntimeReadiness,
  DiscoveredModel,
} from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useState } from "react";

import { Account } from "./Account";
import { AddEndpoint } from "./AddEndpoint";
import { Composer } from "./Composer";
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

function ModelList({
  models,
  backend,
}: {
  models: DiscoveredModel[];
  backend: ConnectedDesktopBackend;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (models.length === 0) {
    return <p>No models installed here.</p>;
  }

  return (
    <ul>
      {models.map((model) => (
        <li key={model.nativeId}>
          <button type="button" onClick={() => setSelected(model.nativeId)}>
            {model.displayName}
          </button>
          {model.parameterSizeBytes === null ? null : (
            <span>{formatBytes(model.parameterSizeBytes)}</span>
          )}
          {model.contextTokens === null ? null : (
            <span>{formatCompactCount(model.contextTokens)} context</span>
          )}
          {model.capabilities.vision ? <span>Vision</span> : null}
          {model.loaded ? <span>Loaded</span> : null}
          {selected === model.nativeId ? <Composer backend={backend} model={model} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function App({ backend }: { backend: ConnectedDesktopBackend }) {
  const [endpoints, setEndpoints] = useState<DesktopEndpoint[]>([]);
  const [readiness, setReadiness] = useState<Record<string, DesktopRuntimeReadiness>>({});
  const [models, setModels] = useState<Record<string, DiscoveredModel[]>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    backend
      .listEndpoints()
      .then(setEndpoints)
      .catch((cause: unknown) => setError(String(cause)));
  }, [backend]);

  useEffect(refresh, [refresh]);

  const forget = useCallback(
    async (endpointId: string) => {
      try {
        await backend.forgetEndpoint(endpointId);
        refresh();
      } catch (cause) {
        setError(String(cause));
      }
    },
    [backend, refresh],
  );

  const check = useCallback(
    async (endpointId: string) => {
      setChecking(endpointId);
      setError(null);

      try {
        const result = await backend.probeEndpoint(endpointId);

        setReadiness((current) => ({ ...current, [endpointId]: result }));

        if (result.status !== "ready") {
          setModels((current) => ({ ...current, [endpointId]: [] }));

          return;
        }

        const discovered = await backend.discoverModels(endpointId);

        setModels((current) => ({ ...current, [endpointId]: discovered }));
      } catch (cause) {
        setError(String(cause));
      } finally {
        setChecking(null);
      }
    },
    [backend],
  );

  return (
    <main>
      <Account backend={backend} />
      <h1>Runtimes on this device</h1>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {endpoints.map((endpoint) => (
          <li key={endpoint.id}>
            <span>{endpoint.label}</span>
            <span>{endpoint.kind === "model" ? "Model runtime" : "Agent runtime"}</span>
            <span>{endpoint.url}</span>
            <span>
              {checking === endpoint.id ? "Checking" : readinessLabel(readiness[endpoint.id])}
            </span>
            <button
              type="button"
              onClick={() => void check(endpoint.id)}
              disabled={checking !== null}
            >
              Check
            </button>
            <button type="button" onClick={() => void forget(endpoint.id)}>
              Forget
            </button>
            {readiness[endpoint.id]?.status === "ready" ? (
              <ModelList models={models[endpoint.id] ?? []} backend={backend} />
            ) : null}
          </li>
        ))}
      </ul>
      <AddEndpoint backend={backend} onAdded={refresh} />
    </main>
  );
}
