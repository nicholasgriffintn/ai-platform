import { createPolychatRequest } from "./polychat-request";

const BROKERED_GIT_METHODS = new Set(["GET", "POST"]);
const FORWARDED_GIT_HEADERS = [
  "accept",
  "accept-encoding",
  "content-encoding",
  "content-type",
  "git-protocol",
] as const;

export interface WorkspaceGitBroker {
  host: string;
  pathPrefix: string;
  grant: string;
}

export function isBrokeredGitRequest(request: Request, broker: WorkspaceGitBroker): boolean {
  const url = new URL(request.url);

  return (
    url.pathname.startsWith(broker.pathPrefix) &&
    BROKERED_GIT_METHODS.has(request.method.toUpperCase())
  );
}

export function forwardBrokeredGit(
  request: Request,
  broker: WorkspaceGitBroker,
  polychatApi: Pick<Fetcher, "fetch">,
): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers();

  for (const name of FORWARDED_GIT_HEADERS) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("Authorization", `Bearer ${broker.grant}`);

  return polychatApi.fetch(
    createPolychatRequest(`${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method.toUpperCase() === "GET" ? undefined : request.body,
    }),
  );
}
