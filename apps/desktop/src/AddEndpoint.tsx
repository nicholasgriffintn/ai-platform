import {
  AGENT_RUNTIME_VENDORS,
  MODEL_RUNTIME_VENDORS,
  desktopEndpointSchema,
  isLoopbackUrl,
  type DesktopEndpoint,
} from "@ngriffin_uk/polychat-schemas";
import { useState, type FormEvent } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

const VENDORS = [...MODEL_RUNTIME_VENDORS, ...AGENT_RUNTIME_VENDORS];

function buildEndpoint(
  vendor: string,
  label: string,
  url: string,
  hasPairingSecret: boolean,
): DesktopEndpoint {
  const isAgent = (AGENT_RUNTIME_VENDORS as readonly string[]).includes(vendor);

  return desktopEndpointSchema.parse({
    id: globalThis.crypto.randomUUID(),
    kind: isAgent ? "agent" : "model",
    vendor,
    label,
    url,
    transport: isLoopbackUrl(url) ? "loopback" : "network",
    pairingSecretStored: hasPairingSecret,
    approvedAt: new Date().toISOString(),
    lastSeenAt: null,
  });
}

export function AddEndpoint({
  backend,
  onAdded,
}: {
  backend: ConnectedDesktopBackend;
  onAdded: () => void;
}) {
  const [vendor, setVendor] = useState<string>(VENDORS[0]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pairingSecret, setPairingSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);

    try {
      await backend.saveEndpoint(
        buildEndpoint(vendor, label.trim(), url.trim(), pairingSecret.trim().length > 0),
        pairingSecret.trim() || undefined,
      );
      setLabel("");
      setUrl("");
      setPairingSecret("");
      onAdded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void add();
      }}
    >
      <h2>Add a runtime</h2>
      <label htmlFor="endpoint-vendor">Runtime</label>
      <select
        id="endpoint-vendor"
        value={vendor}
        onChange={(event) => setVendor(event.target.value)}
      >
        {VENDORS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label htmlFor="endpoint-label">Name</label>
      <input
        id="endpoint-label"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Home server"
      />
      <label htmlFor="endpoint-url">Address</label>
      <input
        id="endpoint-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://nest.local:18789"
      />
      <label htmlFor="endpoint-pairing">Pairing secret</label>
      <input
        id="endpoint-pairing"
        type="password"
        value={pairingSecret}
        onChange={(event) => setPairingSecret(event.target.value)}
        placeholder="Only needed for an agent gateway reached over the network without HTTPS"
        autoComplete="off"
      />
      <button type="submit" disabled={label.trim().length === 0 || url.trim().length === 0}>
        Add
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
