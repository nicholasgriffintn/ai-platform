export function getDurableObjectStub(
  namespace: DurableObjectNamespace | undefined,
  name: string,
): DurableObjectStub | null {
  if (!namespace) {
    return null;
  }

  return namespace.get(namespace.idFromName(name));
}

export function postDurableObjectJson(
  stub: DurableObjectStub,
  url: string,
  body?: unknown,
): Promise<Response> {
  return stub.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function readDurableObjectJson(stub: DurableObjectStub, url: string): Promise<Response> {
  return stub.fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
