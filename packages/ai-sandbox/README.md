# @ngriffin_uk/polychat-ai-sandbox

Run untrusted JavaScript in a fresh Cloudflare dynamic Worker isolate, hand it host tools as plain functions, and decide exactly which hosts it may reach. The package composes `library-sandbox` mechanisms with the Worker Loader binding; the host supplies the loader and, when tools or an allowlist are involved, a loopback `OutboundGateway`.

```ts
import { createCodeMode, createEvaluator } from "@ngriffin_uk/polychat-ai-sandbox";

const evaluator = createEvaluator({
  loader: env.LOADER,
  gateway: (props) => ctx.exports.OutboundGateway({ props }),
});

const result = await evaluator.evaluate({
  module: "export const total = (items) => items.reduce((sum, item) => sum + item.price, 0);",
  script: "return total(env.ITEMS);",
  env: { ITEMS: [{ price: 2 }, { price: 3 }] },
  timeoutMs: 2_000,
});

const codeMode = createCodeMode(evaluator, {
  tools: [{ name: "web_search", inputSchema: searchSchema }],
  invoke: (name, args) => runTool(name, args),
});

const run = await codeMode.run(
  "const hits = await tools.web_search({ query: 'parrots' }); return hits.length;",
);
```

## Evaluate

`evaluate({ script, module?, env?, timeoutMs?, limits?, compatibilityFlags?, network?, tools?, isolation?, signal? })` validates the options (script size, timeout between 100ms and 60s, hostnames in `network`), renders the evaluation template, and loads it with `loader.load` or, for `isolation: "cached"` with no gateway involved, `loader.get(workerCodeId)`. The isolate gets `cpuMs` equal to the timeout unless `limits` says otherwise, `globalOutbound: null` when `network` is `"none"`, and the gateway when tools or an allowlist need mediation. The result is the parsed outcome plus `isolateId`, `cached` and every recorded `toolCalls` entry. Timeouts surface as `SandboxTimeoutError`, caller aborts as `SandboxCancellationError`, and a loader failure as `execution_failed`.

## Outbound gateway

`OutboundGateway` (from `@ngriffin_uk/polychat-ai-sandbox/worker`) is a `WorkerEntrypoint` the host re-exports from its main module. Each evaluation gets a loopback stub carrying `{ allowlist, invocationId, toolsOrigin }` as props. Requests to the virtual tools origin are dispatched to the invoker registered for that invocation, allowlisted hosts are fetched, and everything else is answered with `403 network_blocked`. Invocations live only for the duration of one `evaluate` call.

## Code mode

`createCodeMode(evaluator, { tools, invoke, binding?, network?, timeoutMs? })` fixes a tool set and returns `instructions()` for the model prompt and `run(script)` that evaluates with the tools attached. Tool failures throw a `ToolError` inside the script so the code can recover; every call is recorded with its arguments, duration and outcome.
