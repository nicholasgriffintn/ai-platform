export function createPolychatRequest(path: string, init: RequestInit): Request {
  const headers = new Headers(init.headers);

  headers.set("User-Agent", "Polychat-Sandbox-Worker/1.0 (+https://polychat.app)");

  return new Request(`http://polychat-api${path}`, { ...init, headers });
}

export async function fetchWithTimeout(
  execute: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutHandle);
      throw new DOMException("Request aborted", "AbortError");
    }

    signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    return await execute(controller.signal);
  } finally {
    clearTimeout(timeoutHandle);
    if (signal) {
      signal.removeEventListener("abort", forwardAbort);
    }
  }
}
