import type { EvaluationLoader, EvaluationWorkerCode } from "@ngriffin_uk/polychat-ai-sandbox";
import { dispatchToolRequest } from "@ngriffin_uk/polychat-ai-sandbox";
import {
  USER_MODULE,
  decideOutbound,
  type OutboundGatewayProps,
} from "@ngriffin_uk/polychat-library-sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { run_code } from "../run_code";

const handleFunctions = vi.hoisted(() =>
  vi.fn(async ({ functionName, args }: { functionName: string; args: Record<string, unknown> }) => {
    if (functionName === "web_search") {
      return { status: "success", name: functionName, content: "results", data: { hits: args } };
    }

    return { status: "error", name: functionName, content: "Search backend is down", data: {} };
  }),
);

vi.mock("~/modules/functions/application", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/functions/application")>()),
  handleFunctions,
}));

function moduleUrl(source: string): string {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function fakeLoader(): EvaluationLoader {
  const isolate = (code: EvaluationWorkerCode) => ({
    getEntrypoint: () => ({
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        const main = code.modules[code.mainModule];
        const user = code.modules[USER_MODULE];

        if (typeof main !== "string") {
          throw new Error("Expected a string main module");
        }

        const source = main.replace(
          `import * as __module__ from "./${USER_MODULE}";`,
          typeof user === "string"
            ? `import * as __module__ from ${JSON.stringify(moduleUrl(user))};`
            : "",
        );
        const worker = (await import(moduleUrl(source))) as {
          default: { fetch(request: Request, env: unknown): Promise<Response> };
        };

        return worker.default.fetch(new Request(url, init), code.env);
      },
    }),
  });

  return {
    load: isolate,
    get: (_name, getCode) => {
      const code = getCode();

      if (code instanceof Promise) {
        throw new Error("The fake loader only supports synchronous code");
      }

      return isolate(code);
    },
  };
}

function outboundGateway(props: OutboundGatewayProps) {
  const gateway = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const decision = decideOutbound(props, new URL(request.url));

      if (decision.kind === "tool") {
        return dispatchToolRequest(props.invocationId, decision.tool, request);
      }

      return Response.json({ ok: false, error: { message: decision.kind } }, { status: 403 });
    },
  };

  vi.stubGlobal("fetch", gateway.fetch);

  return gateway;
}

function createToolContext(withLoader = true) {
  const user = { id: 7, plan_id: "pro" };
  const env = withLoader ? { LOADER: fakeLoader() } : {};

  return {
    completionId: "completion-1",
    env,
    user,
    request: {
      env,
      user,
      context: { env, user, requireUser: () => user, outboundGateway },
      request: {},
    },
  } as never;
}

describe("run_code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports when the runtime has no dynamic worker loader", async () => {
    const response = await run_code.execute({ code: "return 1;" }, createToolContext(false));

    expect(response).toMatchObject({
      status: "error",
      content: expect.stringContaining("not available"),
    });
  });

  it("runs a script and returns its value with captured logs", async () => {
    const response = await run_code.execute(
      { code: "console.log('working'); return [1, 2, 3].map((n) => n * 2);" },
      createToolContext(),
    );

    expect(response).toMatchObject({
      status: "success",
      name: "run_code",
      content: expect.stringContaining("[2,4,6]"),
      data: { ok: true, value: [2, 4, 6], toolCalls: [] },
    });
    expect(response.data.logs).toEqual([expect.objectContaining({ message: "working" })]);
  });

  it("routes tool calls through the function registry and surfaces tool failures to the script", async () => {
    const response = await run_code.execute(
      {
        code: `
          const found = await tools.web_search({ query: "parrots" });
          let failure = null;
          try { await tools.research({ query: "x" }); } catch (error) { failure = error.message; }
          return { hits: found.data.hits, failure };
        `,
        tools: ["web_search", "research"],
      },
      createToolContext(),
    );

    expect(response).toMatchObject({
      status: "success",
      data: {
        ok: true,
        value: { hits: { query: "parrots" }, failure: "Search backend is down" },
      },
    });
    expect(handleFunctions).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "web_search",
        args: { query: "parrots" },
        completion_id: "completion-1",
      }),
    );
    expect(response.data.toolCalls).toEqual([
      expect.objectContaining({ name: "web_search", ok: true }),
      expect.objectContaining({ name: "research", ok: false }),
    ]);
  });

  it("refuses tools that need a human, delegation, or itself", async () => {
    for (const tool of ["run_code", "ask_user", "delegate", "missing_tool"]) {
      const response = await run_code.execute(
        { code: "return 1;", tools: [tool] },
        createToolContext(),
      );

      expect(response).toMatchObject({ status: "error", data: { code: "tool_unavailable" } });
    }

    expect(handleFunctions).not.toHaveBeenCalled();
  });

  it("returns script errors as a failed result rather than throwing", async () => {
    const response = await run_code.execute(
      { code: "throw new RangeError('too big');" },
      createToolContext(),
    );

    expect(response).toMatchObject({
      status: "error",
      content: expect.stringContaining("RangeError: too big"),
      data: { ok: false, error: { name: "RangeError" } },
    });
  });
});
