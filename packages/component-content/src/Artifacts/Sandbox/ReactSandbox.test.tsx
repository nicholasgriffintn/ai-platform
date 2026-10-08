import { describe, expect, it } from "vitest";

import { buildReactArtifactDocument, resolveArtifactComponent } from "./reactArtifactDocument";
import { prepareReactArtifactDocument } from "./ReactSandbox";
import { transformReactArtifact } from "./transformReactArtifact";

function runTranspiled(code: string, transpiled: string): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> };
  const require = (name: string): unknown => {
    if (name === "react") {
      return {};
    }

    throw new Error(`unexpected import "${name}"`);
  };

  new Function("require", "module", "exports", transpiled)(require, module, module.exports);
  void code;

  return module.exports;
}

describe("prepareReactArtifactDocument", () => {
  it("compiles a default-exported component into the module wrapper", async () => {
    const document = await prepareReactArtifactDocument(
      'import { useState } from "react";\nexport default function Widget() { const [n] = useState(1); return <p>{n}</p>; }',
      undefined,
    );

    expect(document).toContain("React.createElement");
    expect(document).toContain("exports.default = Widget");
    expect(document).not.toContain("Recharts.min.js");
  });

  it("keeps dollar sequences in the component source intact", async () => {
    const document = await prepareReactArtifactDocument(
      'export default function Price() { return <p>{"$&$1 cost"}</p>; }',
      undefined,
    );

    expect(document).toContain('"$&$1 cost"');
  });

  it("loads Recharts only for components that import it", async () => {
    const document = await prepareReactArtifactDocument(
      'import { LineChart } from "recharts";\nexport default function Chart() { return <LineChart width={10} height={10} data={[]} />; }',
      undefined,
    );

    expect(document).toContain("prop-types.min.js");
    expect(document).toContain("Recharts.min.js");
  });

  it("strips declared data sources before compiling", async () => {
    const document = await prepareReactArtifactDocument(
      '<bindings>[{"id":"issues","provider":"linear","operation":"LINEAR_LIST_ISSUES"}]</bindings>\nexport default function Issues() { return <p>Issues</p>; }',
      undefined,
    );

    expect(document).not.toContain("<bindings>");
    expect(document).toContain("exports.default = Issues");
  });

  it("shows an error instead of rendering when the data sources are malformed", async () => {
    const document = await prepareReactArtifactDocument(
      "<bindings>not json</bindings>\nexport default function Broken() { return null; }",
      undefined,
    );

    expect(document).toContain("data bindings could not be read");
  });

  it("cannot be closed early by a script tag inside the component", async () => {
    const document = await prepareReactArtifactDocument(
      'export default function Sneaky() { return <p>{"</script><script>alert(1)</script>"}</p>; }',
      undefined,
    );

    expect(document).not.toContain("</script><script>alert(1)");
  });

  it("resolves a single named export when there is no default export", async () => {
    const code =
      'import { useState } from "react";\nexport function PomodoroTimer() { const [n] = useState(1); return <p>{n}</p>; }';
    const transpiled = await transformReactArtifact(code);
    const exported = runTranspiled(code, transpiled);

    expect(exported).not.toHaveProperty("default");
    expect(typeof (exported as { PomodoroTimer?: unknown }).PomodoroTimer).toBe("function");
    expect(resolveArtifactComponent(exported)).toBe(
      (exported as { PomodoroTimer?: unknown }).PomodoroTimer,
    );

    const document = await prepareReactArtifactDocument(code, undefined);

    expect(document).toContain("exports.PomodoroTimer = PomodoroTimer");
    expect(document).toContain("as a named export");
  });

  it("prefers the default export over named exports", () => {
    function Default(): null {
      return null;
    }

    function Named(): null {
      return null;
    }

    expect(resolveArtifactComponent({ default: Default, Named })).toBe(Default);
  });

  it("prefers App and capitalized components over helpers", () => {
    function helper(): number {
      return 1;
    }

    function App(): null {
      return null;
    }

    function PomodoroTimer(): null {
      return null;
    }

    expect(resolveArtifactComponent({ helper, App })).toBe(App);
    expect(resolveArtifactComponent({ helper, PomodoroTimer })).toBe(PomodoroTimer);
    expect(resolveArtifactComponent({ helper })).toBe(helper);
  });

  it("resolves memo-style component objects", () => {
    const memo = { $$typeof: Symbol.for("react.memo"), type: () => null };

    expect(resolveArtifactComponent({ Widget: memo })).toBe(memo);
  });

  it("returns null when nothing renderable is exported", () => {
    expect(resolveArtifactComponent({})).toBeNull();
    expect(resolveArtifactComponent({ value: 42 })).toBeNull();
    expect(resolveArtifactComponent(null)).toBeNull();
  });

  it("ships the named-export fallback in the built document", () => {
    const document = buildReactArtifactDocument({
      transpiledCode: "exports.default = function Widget() {};",
      css: undefined,
      usesRecharts: false,
    });

    expect(document).toContain("__esModule");
    expect(document).toContain("as a named export");
  });
});
