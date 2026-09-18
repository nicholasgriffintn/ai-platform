import { isSandboxError, readJsonRecord } from "@ngriffin_uk/polychat-library-sandbox";

import type { ToolCallRecord, ToolInvoker } from "./types.js";

interface ToolInvocation {
  invoke: ToolInvoker;
  calls: ToolCallRecord[];
}

const invocations = new Map<string, ToolInvocation>();

export interface ToolInvocationHandle {
  id: string;
  calls: ToolCallRecord[];
  release(): void;
}

export function registerToolInvocation(invoke: ToolInvoker): ToolInvocationHandle {
  const id = crypto.randomUUID();
  const invocation: ToolInvocation = { invoke, calls: [] };

  invocations.set(id, invocation);

  return {
    id,
    calls: invocation.calls,
    release: () => void invocations.delete(id),
  };
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export async function dispatchToolRequest(
  invocationId: string | undefined,
  tool: string,
  request: Request,
): Promise<Response> {
  const invocation = invocationId ? invocations.get(invocationId) : undefined;

  if (!invocation) {
    return failure(503, "gateway_unavailable", "This sandbox has no tools attached");
  }

  if (request.method !== "POST") {
    return failure(405, "invalid_request", "Tool calls must use POST");
  }

  const args = await readJsonRecord(request);

  if (!args) {
    return failure(400, "invalid_request", "Tool arguments must be a JSON object");
  }

  const started = Date.now();

  try {
    const result = await invocation.invoke(tool, args);

    invocation.calls.push({ name: tool, args, ok: true, durationMs: Date.now() - started });

    return Response.json({ ok: true, result: result ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    invocation.calls.push({
      name: tool,
      args,
      ok: false,
      durationMs: Date.now() - started,
      error: message,
    });

    return isSandboxError(error, "tool_unavailable")
      ? failure(404, error.code, message)
      : Response.json({ ok: false, error: { code: "tool_failed", message } });
  }
}
