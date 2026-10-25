import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { DeviceCredentialScope } from "@ngriffin_uk/polychat-schemas";

const DISCOVER_ROUTES: Array<{ method?: string; path: RegExp }> = [
  { path: /^\/discover(?:\/|$)/ },
  { method: "GET", path: /^\/sources\/[^/]+\/cover$/ },
  { method: "GET", path: /^\/auth\/me$/ },
];

export function credentialRouteScope(method: string, path: string): DeviceCredentialScope {
  const discover = DISCOVER_ROUTES.some(
    (route) => (!route.method || route.method === method) && route.path.test(path),
  );

  return discover ? "discover" : "full";
}

export function credentialAuthenticates(
  scope: DeviceCredentialScope,
  method: string,
  path: string,
): boolean {
  if (scope === "full") {
    return true;
  }

  return authorise("service.call", {
    authenticated: true,
    scopes: [scope],
    requiredScope: credentialRouteScope(method, path),
  }).allowed;
}
