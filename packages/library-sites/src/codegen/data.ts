export function renderSiteDataModule(): string {
  return `import { useEffect, useRef, useState } from "react";
import { setPath, type SiteState } from "./site-state";
import { isRecord } from "./utils";

export interface SiteDataTransport {
  read(): Promise<Record<string, unknown>>;
  perform(action: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export function createSiteDataTransport(options: {
  baseUrl: string;
  siteId: string;
  projectId?: string;
  getRevision: () => number;
  fetchAuthenticated: (url: string, init: RequestInit) => Promise<Response>;
}): SiteDataTransport {
  const base = new URL(options.baseUrl);
  if (base.protocol !== "https:") throw new Error("Use an HTTPS Polychat API");
  const root = base.toString().endsWith("/") ? base.toString() : base.toString() + "/";
  const endpoint = new URL("sites/" + encodeURIComponent(options.siteId) + "/data/", root);

  const request = async (path: string, operation?: Record<string, unknown>) => {
    const expectedRevision = options.getRevision();
    const response = await options.fetchAuthenticated(new URL(path, endpoint).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: options.projectId, expectedRevision, ...(operation ? { operation } : {}) }),
    });
    const raw: unknown = await response.json();
    const payload = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
    if (!response.ok || !isRecord(payload) || payload.revision !== expectedRevision || options.getRevision() !== expectedRevision || !isRecord(payload.bindings)) {
      throw new Error(response.status === 409 ? "The site changed. Reload before continuing" : "Site data could not be loaded");
    }
    return payload.bindings;
  };

  return { read: () => request("read"), perform: (action) => request("actions", action) };
}

declare global {
  interface Window {
    polychatSiteData?: SiteDataTransport;
  }
}

export function useSiteData(initial: SiteState, bindings: Record<string, string>) {
  const [state, setState] = useState<SiteState>(initial);
  const [dataError, setDataError] = useState<string | null>(null);
  const pending = useRef(false);

  const apply = (values: Record<string, unknown>) => setState((current) => {
    let next = current;
    for (const [id, path] of Object.entries(bindings)) {
      next = setPath(next, path, values[id] ?? []);
    }
    return next;
  });

  useEffect(() => {
    let active = true;
    const transport = window.polychatSiteData;
    if (Object.keys(bindings).length && transport) {
      void transport.read().then((values) => { if (active) apply(values); }).catch((error: unknown) => { if (active) setDataError(error instanceof Error ? error.message : "Data could not load"); });
    } else if (Object.keys(bindings).length) {
      apply({});
      setDataError("Connect an authenticated data transport to use saved records.");
    }
    return () => { active = false; };
  }, []);

  const performDataAction = async (action: Record<string, unknown>): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    try {
      if (!window.polychatSiteData) throw new Error("An authenticated data transport is required");
      apply(await window.polychatSiteData.perform(action));
      setDataError(null);
      return true;
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "The data action failed");
      return false;
    } finally {
      pending.current = false;
    }
  };

  return { state, setState, dataError, performDataAction };
}
`;
}
