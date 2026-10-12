import { POLYCHAT_MODEL_BASE_URL, type ModelFetch } from "./polychat-model";

export const MODEL_PORT_SESSION_HEADER = "x-polychat-harness-session";

const MODEL_PORT_HOST = new URL(POLYCHAT_MODEL_BASE_URL).host;
const ports = new Map<string, ModelFetch>();
let installed = false;

function install(): void {
  if (installed) {
    return;
  }

  installed = true;

  const passthrough = globalThis.fetch.bind(globalThis);
  const routed: typeof fetch = async (input, init) => {
    const request = new Request(input, init);

    if (new URL(request.url).host !== MODEL_PORT_HOST) {
      return passthrough(request);
    }

    const session = request.headers.get(MODEL_PORT_SESSION_HEADER);
    const port = session ? ports.get(session) : undefined;

    if (!port) {
      return new Response("Unknown agent session", { status: 404 });
    }

    const headers = new Headers(request.headers);

    headers.delete(MODEL_PORT_SESSION_HEADER);

    return port(new Request(request, { headers }));
  };

  globalThis.fetch = routed;
}

export function registerModelPort(session: string, fetch: ModelFetch): void {
  install();
  ports.set(session, fetch);
}
