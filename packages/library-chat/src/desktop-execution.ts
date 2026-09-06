import type { DesktopEndpoint, ModelRuntimeVendor } from "@ngriffin_uk/polychat-schemas";

import type { DesktopBackend } from "./desktop-backend";

let backend: DesktopBackend | null = null;

export function setDesktopExecutionBackend(next: DesktopBackend): void {
  backend = next;
}

export function desktopExecutionBackend(): DesktopBackend | null {
  return backend;
}

export function findModelRuntimeEndpoint(
  endpoints: DesktopEndpoint[],
  vendor: string | undefined,
): DesktopEndpoint | undefined {
  if (!vendor) {
    return undefined;
  }

  return endpoints.find(
    (endpoint) => endpoint.kind === "model" && endpoint.vendor === (vendor as ModelRuntimeVendor),
  );
}
