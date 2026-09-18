import {
  decideOutbound,
  USER_MODULE,
  type OutboundGatewayProps,
  type WorkerCodeSpec,
} from "@ngriffin_uk/polychat-library-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCodeMode } from "../code-mode.js";
import { createEvaluator } from "../evaluator.js";
import { dispatchToolRequest } from "../tool-invocations.js";
import type { EvaluationIsolate, EvaluationLoader, OutboundFetcher } from "../types.js";

function moduleUrl(source: string): string {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

async function importSpec(spec: WorkerCodeSpec) {
  const main = spec.modules[spec.mainModule];
  const user = spec.modules[USER_MODULE];

  if (typeof main !== "string" || (user !== undefined && typeof user !== "string")) {
    throw new Error("Expected string modules");
  }

  const source = main.replace(
    `import * as __module__ from "./${USER_MODULE}";`,
    user ? `import * as __module__ from ${JSON.stringify(moduleUrl(user))};` : "",
  );

  return (await import(moduleUrl(source))) as {
    default: { fetch(request: Request, env: unknown): Promise<Response> };
  };
}

function fakeLoader() {
  const loaded: WorkerCodeSpec[] = [];
  const cached = new Map<string, WorkerCodeSpec>();
  const stubFor = (spec: WorkerCodeSpec): EvaluationIsolate => ({
    getEntrypoint: () => ({
      fetch: async (url, init) => {
        const worker = await importSpec(spec);

        return worker.default.fetch(new Request(url, init), spec.env);
      },
    }),
  });
  const loader: EvaluationLoader = {
    load: (spec) => {
      loaded.push(spec);

      return stubFor(spec);
    },
    get: (name, getCode) => {
      const existing = cached.get(name);
      const spec = existing ?? getCode();

      if (spec instanceof Promise) {
        throw new Error("The fake loader only supports synchronous code");
      }

      if (!existing) {
        cached.set(name, spec);
      }

      loaded.push(spec);

      return stubFor(spec);
    },
  };

  return { loader, loaded, cached };
}

function fakeGateway(props: OutboundGatewayProps): OutboundFetcher {
  const gateway: OutboundFetcher = {
    fetch: async (input, init) => {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEvaluator", () => {
  it("runs a script against a module with env and blocks outbound traffic by default", async () => {
    const { loader, loaded } = fakeLoader();
    const evaluator = createEvaluator({ loader });

    const result = await evaluator.evaluate({
      module: "export const double = (n) => n * 2;",
      script: "console.log('doubling'); return double(env.BASE);",
      env: { BASE: 21 },
    });

    expect(result).toMatchObject({ ok: true, value: 42, cached: false, toolCalls: [] });
    expect(result.logs.map((entry) => entry.message)).toEqual(["doubling"]);
    expect(loaded[0]?.globalOutbound).toBeNull();
    expect(loaded[0]?.limits).toEqual({ cpuMs: 5000, subRequests: undefined });
  });

  it("reuses a cached isolate for identical code and rejects invalid options", async () => {
    const { loader, cached } = fakeLoader();
    const evaluator = createEvaluator({ loader });

    const first = await evaluator.evaluate({ script: "return 1;", isolation: "cached" });
    const second = await evaluator.evaluate({ script: "return 1;", isolation: "cached" });
    const other = await evaluator.evaluate({ script: "return 2;", isolation: "cached" });

    expect(first.cached).toBe(true);
    expect(first.isolateId).toBe(second.isolateId);
    expect(other.isolateId).not.toBe(first.isolateId);
    expect(cached.size).toBe(2);

    await expect(evaluator.evaluate({ script: "   " })).rejects.toMatchObject({
      code: "invalid_options",
    });
    await expect(
      evaluator.evaluate({ script: "return 1;", timeoutMs: 999_999 }),
    ).rejects.toMatchObject({
      code: "invalid_options",
    });
  });

  it("refuses tools and allowlists without a gateway", async () => {
    const { loader } = fakeLoader();
    const evaluator = createEvaluator({ loader });

    await expect(
      evaluator.evaluate({ script: "return 1;", network: ["api.example.com"] }),
    ).rejects.toMatchObject({ code: "gateway_unavailable" });
  });

  it("routes tool calls through the gateway, records them and releases the invocation", async () => {
    const { loader, loaded } = fakeLoader();
    const seen: OutboundGatewayProps[] = [];
    const evaluator = createEvaluator({
      loader,
      gateway: (gatewayProps) => {
        seen.push(gatewayProps);

        return fakeGateway(gatewayProps);
      },
    });
    const invoke = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "fail") {
        throw new Error("nope");
      }

      return { echoed: args, name };
    });

    const result = await evaluator.evaluate({
      script: `
        const first = await tools.search({ query: "parrots" });
        let failure = null;
        try { await tools.fail({}); } catch (error) { failure = error.name + ": " + error.message; }
        return { first, failure };
      `,
      tools: {
        definitions: [{ name: "search" }, { name: "fail" }],
        invoke,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        first: { echoed: { query: "parrots" }, name: "search" },
        failure: "ToolError: nope",
      },
      cached: false,
    });
    expect(result.toolCalls).toEqual([
      expect.objectContaining({ name: "search", ok: true }),
      expect.objectContaining({ name: "fail", ok: false, error: "nope" }),
    ]);
    expect(seen[0]).toMatchObject({ allowlist: "none", invocationId: expect.any(String) });
    expect(loaded[0]?.globalOutbound).toBeDefined();

    const stale = await dispatchToolRequest(
      seen[0]?.invocationId,
      "search",
      new Request("https://tools.polychat.invalid/search", { method: "POST", body: "{}" }),
    );

    expect(stale.status).toBe(503);
  });

  it("times out long-running scripts", async () => {
    const { loader } = fakeLoader();
    const evaluator = createEvaluator({ loader });

    await expect(
      evaluator.evaluate({
        script: "await new Promise((resolve) => setTimeout(resolve, 500)); return 1;",
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("createCodeMode", () => {
  it("describes the tools for the model and runs scripts with them attached", async () => {
    const { loader } = fakeLoader();
    const evaluator = createEvaluator({
      loader,
      gateway: fakeGateway,
    });
    const codeMode = createCodeMode(evaluator, {
      tools: [
        {
          name: "weather",
          description: "Current weather",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      ],
      invoke: async (_name, args) => ({ city: args.city, temperature: 18 }),
    });

    expect(codeMode.instructions()).toContain("tools.weather({ city: string }): Promise<unknown>");

    const result = await codeMode.run(
      "return (await tools.weather({ city: 'Leeds' })).temperature;",
    );

    expect(result).toMatchObject({ ok: true, value: 18 });
    expect(result.toolCalls).toHaveLength(1);
  });

  it("runs without a gateway when no tools are attached", async () => {
    const { loader, loaded } = fakeLoader();
    const codeMode = createCodeMode(createEvaluator({ loader }), {
      tools: [],
      invoke: async () => null,
    });

    await expect(codeMode.run("return 'quiet';")).resolves.toMatchObject({
      ok: true,
      value: "quiet",
    });
    expect(loaded[0]?.globalOutbound).toBeNull();
  });
});
