import { describe, expect, it } from "vitest";

import { prepareReactArtifactDocument } from "./ReactSandbox";

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
});
