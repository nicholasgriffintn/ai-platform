import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { DeviceCredentialScope } from "@ngriffin_uk/polychat-schemas";

type LimitedScope = Exclude<DeviceCredentialScope, "full">;

const SCOPED_ROUTES: Record<LimitedScope, Array<{ method?: string; path: RegExp }>> = {
  discover: [
    { path: /^\/discover(?:\/|$)/ },
    { method: "GET", path: /^\/sources\/[^/]+\/cover$/ },
    { method: "GET", path: /^\/auth\/me$/ },
  ],
  pashi: [
    { method: "POST", path: /^\/chat\/completions$/ },
    { method: "POST", path: /^\/decisions$/ },
    { path: /^\/pashi\/link$/ },
  ],
};

function routeAllows(scope: LimitedScope, method: string, path: string): boolean {
  return SCOPED_ROUTES[scope].some(
    (route) => (!route.method || route.method === method) && route.path.test(path),
  );
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
    requiredScope: routeAllows(scope, method, path) ? scope : "full",
  }).allowed;
}
