import { describe, expect, it } from "vitest";

import { transformComponentCode } from "./ReactSandbox";

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
