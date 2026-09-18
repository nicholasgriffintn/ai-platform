import { describe, expect, it } from "vitest";

import { parseEvaluationOutcome } from "../evaluation-result.js";
import { renderEvaluationTemplate, USER_MODULE } from "../evaluation-template.js";
import { listModuleExports, moduleHasDefaultExport } from "../module-exports.js";

async function runTemplate(
  options: Parameters<typeof renderEvaluationTemplate>[0],
  env: Record<string, unknown> = {},
) {
  const template = renderEvaluationTemplate(options);
  const userModule = template.modules[USER_MODULE];
  const userModuleUrl = userModule
    ? `data:text/javascript;base64,${Buffer.from(userModule).toString("base64")}`
    : null;
  const main = template.modules[template.mainModule]?.replace(
    `import * as __module__ from "./${USER_MODULE}";`,
    userModuleUrl ? `import * as __module__ from ${JSON.stringify(userModuleUrl)};` : "",
  );
  const worker = (await import(
    `data:text/javascript;base64,${Buffer.from(main ?? "").toString("base64")}`
  )) as { default: { fetch(request: Request, env: unknown): Promise<Response> } };

  return parseEvaluationOutcome(
    await (await worker.default.fetch(new Request("https://run"), env)).json(),
  );
}

describe("renderEvaluationTemplate", () => {
  it("returns the script value, captures console output and exposes module exports", async () => {
    const outcome = await runTemplate({
      module: "export const add = (a, b) => a + b;\nexport default 40;",
      script: "console.log('adding', { a: 1 }); return add(defaultExport, 2);",
    });

    expect(outcome).toMatchObject({ ok: true, value: 42 });
    expect(outcome.logs).toEqual([
      expect.objectContaining({ level: "log", message: 'adding {"a":1}' }),
    ]);
  });

  it("passes only the allowlisted env keys to the script", async () => {
    const outcome = await runTemplate(
      {
        script: "return { who: env.WHO, secret: env.SECRET, keys: Object.keys(env) };",
        envKeys: ["WHO"],
      },
      { WHO: "sandbox", SECRET: "hidden" },
    );

    expect(outcome).toMatchObject({ ok: true, value: { who: "sandbox", keys: ["WHO"] } });
  });

  it("reports thrown errors with their name and message instead of failing the request", async () => {
    const outcome = await runTemplate({
      script: "console.warn('about to fail'); throw new TypeError('bad input');",
    });

    expect(outcome).toMatchObject({
      ok: false,
      error: { name: "TypeError", message: "bad input" },
      logs: [expect.objectContaining({ level: "warn" })],
    });
  });

  it("serialises values JSON cannot represent instead of crashing", async () => {
    const outcome = await runTemplate({
      script: "return { big: 10n, set: new Set([1, 2]), nothing: undefined };",
    });

    expect(outcome).toMatchObject({ ok: true, value: { big: "10", set: [1, 2] } });
  });

  it("makes the tools preamble available to the script", async () => {
    const outcome = await runTemplate({
      preamble: "const tools = Object.freeze({ ping: async () => 'pong' });",
      script: "return tools.ping();",
    });

    expect(outcome).toMatchObject({ ok: true, value: "pong" });
  });
});

describe("module export detection", () => {
  it("lists declaration and list exports and detects a default export", () => {
    const source = `
export const a = 1;
export async function b() {}
export class C {}
const d = 2, e = 3;
export { d, e as f };
export default a;
`;

    expect(listModuleExports(source)).toEqual(["a", "b", "C", "d", "f"]);
    expect(moduleHasDefaultExport(source)).toBe(true);
    expect(moduleHasDefaultExport("export const x = 1;")).toBe(false);
  });
});
