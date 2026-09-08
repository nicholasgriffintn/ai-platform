export async function fetchOllamaFixture(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input);

  if (url.origin !== "http://127.0.0.1:11434") {
    throw new Error(`Unexpected Ollama request: ${url.origin}`);
  }

  init?.signal?.throwIfAborted();
  if (url.pathname === "/api/version") {
    return Response.json({ version: "e2e-fixture" });
  }

  if (url.pathname === "/api/tags") {
    return Response.json({ models: [{ model: "gemma3:1b" }] });
  }

  if (url.pathname === "/api/chat" && init?.method === "POST") {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;

    if (body?.model !== "gemma3:1b" || !Array.isArray(body.messages) || body.stream !== true) {
      throw new Error("The desktop sent an invalid Ollama completion request.");
    }

    return new Response(
      [
        JSON.stringify({ message: { role: "assistant", content: "4" }, done: false }),
        JSON.stringify({ message: { role: "assistant", content: "" }, done: true }),
        "",
      ].join("\n"),
      { headers: { "content-type": "application/x-ndjson" } },
    );
  }

  throw new Error(`Unexpected Ollama request: ${init?.method ?? "GET"} ${url.pathname}`);
}
