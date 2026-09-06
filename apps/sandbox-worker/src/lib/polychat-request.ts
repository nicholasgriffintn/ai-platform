export function createPolychatRequest(path: string, init: RequestInit): Request {
  const headers = new Headers(init.headers);

  headers.set("User-Agent", "Polychat-Sandbox-Worker/1.0 (+https://polychat.app)");

  return new Request(`http://polychat-api${path}`, { ...init, headers });
}
