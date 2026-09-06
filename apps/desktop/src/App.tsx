import {
  ModelSourcePicker,
  type ModelSourceSelection,
} from "@ngriffin_uk/polychat-component-models";
import {
  HOSTED_ENDPOINT_ID,
  type DesktopEndpoint,
  type DesktopRuntimeReadiness,
  type DiscoveredModel,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useState } from "react";

import { Account } from "./Account";
import { AddEndpoint } from "./AddEndpoint";
import { AgentSessions } from "./AgentSessions";
import { CloudComposer } from "./CloudComposer";
import { Composer } from "./Composer";
import type { ConnectedDesktopBackend } from "./desktop-backend";
import { Diagnostics } from "./Diagnostics";
import { buildModelSources } from "./modelSources";

export function App({ backend }: { backend: ConnectedDesktopBackend }) {
  const [endpoints, setEndpoints] = useState<DesktopEndpoint[]>([]);
  const [readiness, setReadiness] = useState<Record<string, DesktopRuntimeReadiness>>({});
  const [models, setModels] = useState<Record<string, DiscoveredModel[]>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [selection, setSelection] = useState<ModelSourceSelection | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    backend
      .listEndpoints()
      .then(setEndpoints)
      .catch((cause: unknown) => setError(String(cause)));
  }, [backend]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    let active = true;

    async function readSession() {
      try {
        const current = await backend.isSignedIn();

        if (active) {
          setSignedIn(current);
        }
      } catch {
        void 0;
      }
    }

    void readSession();

    return () => {
      active = false;
    };
  }, [backend]);

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
    async (endpoint: DesktopEndpoint) => {
      setChecking(endpoint.id);
      setError(null);

      try {
        const result = await backend.probeEndpoint(endpoint.id);

        setReadiness((current) => ({ ...current, [endpoint.id]: result }));

        if (result.status === "ready" && endpoint.kind === "model") {
          const discovered = await backend.discoverModels(endpoint.id);

          setModels((current) => ({ ...current, [endpoint.id]: discovered }));
        }
      } catch (cause) {
        setError(String(cause));
      } finally {
        setChecking(null);
      }
    },
    [backend],
  );

  const sources = buildModelSources({ endpoints, readiness, models, checking, signedIn });
  const chosenModel =
    selection?.location === "device"
      ? (models[selection.sourceId] ?? []).find((model) => model.nativeId === selection.entryId)
      : undefined;

  return (
    <main>
      <Account backend={backend} onSignedInChange={setSignedIn} />
      <h1>Models</h1>
      {error ? <p role="alert">{error}</p> : null}
      <ModelSourcePicker sources={sources} selected={selection} onSelect={setSelection} />
      {chosenModel ? <Composer backend={backend} model={chosenModel} /> : null}
      {selection?.sourceId === HOSTED_ENDPOINT_ID ? (
        <CloudComposer backend={backend} tier={selection.entryId} />
      ) : null}
      <h2>Runtimes</h2>
      <ul>
        {endpoints.map((endpoint) => (
          <li key={endpoint.id}>
            <span>{endpoint.label}</span>
            <span>{endpoint.kind === "model" ? "Model runtime" : "Agent runtime"}</span>
            <span>{endpoint.url}</span>
            <button type="button" onClick={() => void check(endpoint)} disabled={checking !== null}>
              Check
            </button>
            <button type="button" onClick={() => void forget(endpoint.id)}>
              Forget
            </button>
            {readiness[endpoint.id]?.status === "ready" && endpoint.kind === "agent" ? (
              <AgentSessions backend={backend} endpoint={endpoint} />
            ) : null}
          </li>
        ))}
      </ul>
      <AddEndpoint backend={backend} onAdded={refresh} />
      <Diagnostics backend={backend} />
    </main>
  );
}
