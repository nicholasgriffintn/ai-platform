import { describe, expect, it } from "vitest";

import { transformComponentCode } from "./ReactSandbox";

describe("React default export detection", () => {
  it("names a default exported function declaration", async () => {
    const { transpiledCode } = await transformComponentCode(
      "export default function Widget() { return <p>hi</p>; }",
    );

    expect(transpiledCode).toContain("Widget");
    expect(transpiledCode).not.toContain("export default function");
  });

  it("names a plain default export", async () => {
    const { transpiledCode } = await transformComponentCode(
      "function Widget() { return <p>hi</p>; }\nexport default Widget;",
    );

    expect(transpiledCode).toContain("Widget");
  });

  it("stays linear on a declaration that never closes", async () => {
    const started = Date.now();

    await transformComponentCode(`export default function Widget(${"a,".repeat(50_000)}`).catch(
      () => undefined,
    );

    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

describe("React artifact transformation", () => {
  it("uses the React UMD global without requiring the JSX runtime module", async () => {
    const { transpiledCode } = await transformComponentCode(`
      import React from "react";

      function Example() {
        return <button>Rendered</button>;
      }

      export default Example;
    `);

    expect(transpiledCode).toContain(".createElement");
    expect(transpiledCode).not.toContain("react/jsx-runtime");
  });
});
